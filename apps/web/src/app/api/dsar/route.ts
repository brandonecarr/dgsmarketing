import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db, dsarRequests, tenants } from "@rosie/db";
import { eq } from "@rosie/db";
import { recordAudit } from "@/lib/audit";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Body = z.object({
  kind: z.enum(["export", "delete"]),
  tenantSlug: z.string().min(1).max(80),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(30).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  // Rate-limit per IP — DSAR is anonymous so we can't rate-limit per tenant.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anon";
  const rl = await checkRateLimit({ tier: "webhook", identifier: `dsar:${ip}` });
  if (!rl.ok) return rateLimitResponse(rl);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  if (!parsed.data.email && !parsed.data.phone) {
    return NextResponse.json({ error: "email or phone required" }, { status: 400 });
  }

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, parsed.data.tenantSlug))
    .limit(1);
  if (!tenant) {
    // Return success-looking response anyway so we don't leak which tenants exist.
    return NextResponse.json({ ok: true, queued: true });
  }

  const ipHash = ip === "anon" ? undefined : createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const [row] = await db
    .insert(dsarRequests)
    .values({
      tenantId: tenant.id,
      kind: parsed.data.kind,
      email: parsed.data.email,
      phone: parsed.data.phone,
      notes: parsed.data.notes,
      ipHash,
    })
    .returning({ id: dsarRequests.id });

  await recordAudit({
    tenantId: tenant.id,
    actorLabel: "system",
    action: "data.delete_request",
    entityType: "dsar_request",
    entityId: row?.id,
    summary: `Public ${parsed.data.kind} request from ${parsed.data.email ?? parsed.data.phone}`,
    payload: { email: parsed.data.email, phone: parsed.data.phone, kind: parsed.data.kind },
    headers: req.headers,
  });

  return NextResponse.json({ ok: true, requestId: row?.id });
}
