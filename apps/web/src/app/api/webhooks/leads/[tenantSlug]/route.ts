import { NextResponse } from "next/server";
import { z } from "zod";
import { db, leads, integrations, memberships, users, consentRecords } from "@rosie/db";
import { and, eq, or } from "@rosie/db";
import { TCPA_DISCLOSURE } from "@/lib/compliance/sms";
import { createHash } from "node:crypto";
import { resolveTenantBySlug } from "@/lib/conversations";
import { sendEmail } from "@/lib/email";
import { newLeadEmail } from "@/lib/email-templates";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { enrollLead } from "@/lib/cadences/engine";
import { triggerLeadAssistant } from "@/lib/lead-assistant";
import { sendPushToTenant } from "@/lib/push";
import { emitEvent } from "@/lib/webhooks-out";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Flexible lead intake. Accepts:
 *  - Facebook lead form payload (via Make.com or a CAPI bridge): field_data array
 *  - Generic JSON: { name, phone, email, source?, metadata? }
 *
 * Auth: optional header `X-Rosie-Webhook-Secret` matching the integration row's `webhookSecret`
 * (we look up the "make" integration for now; can be extended per-source later).
 */

const AttributionSchema = z
  .object({
    eventId: z.string().optional(),
    fbp: z.string().optional(),
    fbc: z.string().optional(),
    gclid: z.string().optional(),
    gbraid: z.string().optional(),
    wbraid: z.string().optional(),
    ttclid: z.string().optional(),
    utmSource: z.string().optional(),
    utmMedium: z.string().optional(),
    utmCampaign: z.string().optional(),
    utmTerm: z.string().optional(),
    utmContent: z.string().optional(),
    landingPageId: z.string().optional(),
    qrCode: z.string().optional(),
  })
  .partial();

const GenericLeadSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  source: z
    .enum(["fb_lead_form", "web_form", "make_webhook", "manual", "import"])
    .optional(),
  metadata: z.record(z.unknown()).optional(),
  attribution: AttributionSchema.optional(),
});

const FbLeadSchema = z.object({
  field_data: z.array(
    z.object({ name: z.string(), values: z.array(z.string()) }),
  ),
});

function fromFbFields(data: z.infer<typeof FbLeadSchema>) {
  const map: Record<string, string> = {};
  for (const f of data.field_data) {
    map[f.name.toLowerCase()] = f.values[0] ?? "";
  }
  return {
    name: map.full_name || [map.first_name, map.last_name].filter(Boolean).join(" ") || undefined,
    phone: map.phone_number || map.phone,
    email: map.email,
    metadata: map,
  };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-rosie-webhook-secret, authorization",
  "Access-Control-Max-Age": "86400",
} as const;

/** CORS preflight — required so embed widgets on operator sites can POST here. */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params;

  const rl = await checkRateLimit({ tier: "webhook", identifier: `leads:${tenantSlug}` });
  if (!rl.ok) return rateLimitResponse(rl);

  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant)
    return NextResponse.json({ error: "unknown tenant" }, { status: 404, headers: CORS_HEADERS });

  // Optional auth: per-tenant Make integration webhook secret.
  const integ = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.tenantId, tenant.id), eq(integrations.provider, "make")))
    .limit(1);

  const expected = integ[0]?.webhookSecret ?? null;
  if (expected) {
    const presented =
      req.headers.get("x-rosie-webhook-secret") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (presented !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }
  }

  // Accept JSON (Make.com, FB CAPI bridges) or form-encoded (our /p/[slug] form).
  let body: unknown;
  const contentType = req.headers.get("content-type") ?? "";
  const isFormPost =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");
  try {
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (isFormPost) {
      const fd = await req.formData();
      const obj: Record<string, unknown> = {};
      fd.forEach((v, k) => {
        obj[k] = typeof v === "string" ? v : v.name;
      });
      body = obj;
    } else {
      body = await req.json().catch(() => ({}));
    }
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400, headers: CORS_HEADERS });
  }

  const fb = FbLeadSchema.safeParse(body);
  const parsed = fb.success
    ? { ...fromFbFields(fb.data), source: "fb_lead_form" as const }
    : GenericLeadSchema.safeParse(body);

  let payload:
    | {
        name?: string;
        phone?: string;
        email?: string;
        source?:
          | "fb_lead_form"
          | "web_form"
          | "make_webhook"
          | "manual"
          | "import";
        metadata?: Record<string, unknown>;
        attribution?: z.infer<typeof AttributionSchema>;
      }
    | null = null;

  if (fb.success) {
    payload = { ...fromFbFields(fb.data), source: "fb_lead_form" };
  } else if (parsed && "success" in parsed && parsed.success) {
    payload = { ...parsed.data, source: parsed.data.source ?? "make_webhook" };
  }

  if (!payload || (!payload.phone && !payload.email)) {
    return NextResponse.json(
      { error: "lead requires phone or email" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Augment attribution from headers + URL for HTML form posts.
  const url = new URL(req.url);
  const fromHeaders = {
    ipAddress:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  };
  const fromQuery = {
    fbp: url.searchParams.get("fbp") ?? undefined,
    fbc: url.searchParams.get("fbc") ?? undefined,
    gclid: url.searchParams.get("gclid") ?? undefined,
    gbraid: url.searchParams.get("gbraid") ?? undefined,
    wbraid: url.searchParams.get("wbraid") ?? undefined,
    ttclid: url.searchParams.get("ttclid") ?? undefined,
    utmSource: url.searchParams.get("utm_source") ?? undefined,
    utmMedium: url.searchParams.get("utm_medium") ?? undefined,
    utmCampaign: url.searchParams.get("utm_campaign") ?? undefined,
    qrCode: url.searchParams.get("q") ?? undefined,
  };
  // Prefer the eventId set by the landing page (paired with the client Pixel)
  // so server + client conversions can dedupe. Fall back to a fresh id.
  const eventIdFromForm = url.searchParams.get("eventId");
  const attribution = {
    eventId: eventIdFromForm || payload.attribution?.eventId || crypto.randomUUID(),
    ...fromQuery,
    ...(payload.attribution ?? {}),
    ...fromHeaders,
  };

  const now = new Date();
  const [lead] = await db
    .insert(leads)
    .values({
      tenantId: tenant.id,
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      source: payload.source ?? "make_webhook",
      stage: "new",
      metadata: payload.metadata,
      attribution,
      firstContactAt: now,
      lastMessageAt: now,
    })
    .returning({ id: leads.id });

  // TCPA: record explicit consent when the form/payload indicates it.
  const bodyObj = body as Record<string, unknown> | null;
  const smsConsent =
    bodyObj?.smsConsent === "1" ||
    bodyObj?.smsConsent === true ||
    bodyObj?.sms_consent === "1" ||
    bodyObj?.sms_consent === true;
  if (lead?.id && payload.phone && smsConsent) {
    const brandName =
      (tenant.brandTheme as { displayName?: string } | null)?.displayName ?? tenant.name;
    await db
      .insert(consentRecords)
      .values({
        tenantId: tenant.id,
        leadId: lead.id,
        phone: payload.phone,
        email: payload.email,
        method: isFormPost ? "web_form" : "lead_webhook",
        scope: "sms_marketing",
        disclosure: TCPA_DISCLOSURE(brandName),
        userResponse: "checkbox:checked",
        source:
          typeof bodyObj?.landingPageId === "string"
            ? `landing:${String(bodyObj.landingPageId)}`
            : payload.source ?? "web_form",
        ipHash: fromHeaders.ipAddress
          ? createHash("sha256").update(fromHeaders.ipAddress).digest("hex").slice(0, 32)
          : undefined,
        userAgent: fromHeaders.userAgent,
      })
      .catch((e) => console.error("consent record failed", e));
  }

  // Notify the tenant's owners/operators. Best-effort; never block intake.
  if (lead?.id) {
    notifyOwnersOfNewLead({
      tenantId: tenant.id,
      tenantName: tenant.name,
      brandTheme: tenant.brandTheme ?? {},
      lead: {
        id: lead.id,
        name: payload.name ?? null,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
        source: payload.source ?? "make_webhook",
        metadata: payload.metadata ?? null,
      },
      baseUrl: new URL(req.url).origin,
    }).catch((e) => console.error("new-lead email fan-out failed", e));

    // Enroll into any "lead_created" cadences.
    enrollLead({ tenantId: tenant.id, leadId: lead.id, trigger: "lead_created" }).catch((e) =>
      console.error("cadence enroll failed", e),
    );

    // Lead Assistant: fire the first-touch agent if the tenant opted in.
    triggerLeadAssistant({ tenantId: tenant.id, leadId: lead.id }).catch((e) =>
      console.error("lead assistant trigger failed", e),
    );

    // Fan out a lead.created event to subscribed external endpoints.
    emitEvent(tenant.id, "lead.created", {
      leadId: lead.id,
      name: payload.name ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      source: payload.source ?? "make_webhook",
      stage: "new",
      attribution,
    }).catch((e) => console.error("outbound webhook fan-out failed", e));

    // Web-push notification — best-effort, never blocks intake.
    sendPushToTenant(tenant.id, {
      title: `New lead${payload.name ? `: ${payload.name}` : ""}`,
      body:
        (payload.phone ?? payload.email ?? "Unknown contact") +
        (payload.source ? ` · ${payload.source}` : ""),
      url: `/inbox?lead=${lead.id}`,
      tag: "rosie-new-lead",
    }).catch((e) => console.error("push notify failed", e));
  }

  // Browser-form submits redirect to a thank-you page; API callers get JSON.
  if (isFormPost) {
    return NextResponse.redirect(`${new URL(req.url).origin}/p/thanks?ref=${tenantSlug}`, 303);
  }

  return NextResponse.json({ ok: true, leadId: lead?.id }, { headers: CORS_HEADERS });
}

async function notifyOwnersOfNewLead(opts: {
  tenantId: string;
  tenantName: string;
  brandTheme: { primaryColor?: string; displayName?: string; hidePoweredBy?: boolean };
  lead: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    source: string;
    metadata: Record<string, unknown> | null;
  };
  baseUrl: string;
}) {
  const owners = await db
    .select({ email: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.tenantId, opts.tenantId),
        or(eq(memberships.role, "owner"), eq(memberships.role, "operator")),
      ),
    );
  if (owners.length === 0) return;

  const tpl = newLeadEmail({
    brand: {
      primary: opts.brandTheme.primaryColor,
      displayName: opts.brandTheme.displayName ?? opts.tenantName,
      hidePoweredBy: opts.brandTheme.hidePoweredBy,
    },
    leadName: opts.lead.name,
    leadPhone: opts.lead.phone,
    leadEmail: opts.lead.email,
    source: opts.lead.source,
    metadata: opts.lead.metadata,
    inboxUrl: `${opts.baseUrl}/inbox`,
  });

  await sendEmail({
    to: owners.map((o) => o.email),
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    tags: [
      { name: "kind", value: "new_lead" },
      { name: "tenant", value: opts.tenantId },
    ],
  });
}
