import { NextResponse } from "next/server";
import { z } from "zod";
import { db, tenants, landingPages } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({
  customDomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "must be a bare hostname like leads.acme.com")
    .max(253)
    .nullable()
    .optional(),
  customDomainRootSlug: z.string().max(120).nullable().optional(),
});

export async function PATCH(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "invalid body" }, { status: 400 });
  }

  const update: { customDomain?: string | null; customDomainRootSlug?: string | null; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if ("customDomain" in parsed.data) update.customDomain = parsed.data.customDomain ?? null;
  if ("customDomainRootSlug" in parsed.data) {
    const slug = parsed.data.customDomainRootSlug?.trim() || null;
    if (slug) {
      // Make sure the slug actually belongs to this tenant.
      const [page] = await db
        .select({ id: landingPages.id })
        .from(landingPages)
        .where(and(eq(landingPages.tenantId, session.tenant.id), eq(landingPages.slug, slug)))
        .limit(1);
      if (!page) {
        return NextResponse.json({ error: `no landing page with slug "${slug}"` }, { status: 400 });
      }
    }
    update.customDomainRootSlug = slug;
  }

  try {
    await db.update(tenants).set(update).where(eq(tenants.id, session.tenant.id));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update failed";
    // Likely the unique index — surface a friendly message.
    if (msg.toLowerCase().includes("duplicate") || msg.includes("23505")) {
      return NextResponse.json({ error: "that domain is already claimed by another tenant" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "tenant.update",
    entityType: "tenant",
    entityId: session.tenant.id,
    summary: update.customDomain
      ? `Custom domain set to ${update.customDomain}`
      : "Custom domain cleared",
    payload: parsed.data,
    headers: req.headers,
  });

  return NextResponse.json({ ok: true });
}
