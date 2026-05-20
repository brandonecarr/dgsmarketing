import { NextResponse } from "next/server";
import { z } from "zod";
import { db, customers } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

const SERVICE_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const Body = z.object({
  updates: z
    .array(
      z.object({
        customerId: z.string().uuid(),
        serviceDays: z.array(z.enum(SERVICE_DAYS)).max(7),
      }),
    )
    .min(1)
    .max(1000),
  /** When true, keep any pre-existing days alongside the proposed ones. */
  mergeWithExisting: z.boolean().optional(),
});

/**
 * Apply a batch of serviceDays updates — typically the output of the weekly
 * planner. One UPDATE per row (Drizzle doesn't support bulk-update with a
 * derived `(id, value)` table out of the box), but with pool size 1 +
 * connection reuse this still cuts a 100-customer plan to ~1s.
 */
export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  let updated = 0;
  let notFound = 0;

  // Hydrate existing days when merging — single read beats N reads.
  let existingDaysById = new Map<string, string[]>();
  if (parsed.data.mergeWithExisting) {
    const rows = await db
      .select({ id: customers.id, serviceDays: customers.serviceDays })
      .from(customers)
      .where(eq(customers.tenantId, session.tenant.id));
    for (const r of rows) existingDaysById.set(r.id, r.serviceDays);
  }

  for (const u of parsed.data.updates) {
    let nextDays: typeof u.serviceDays = u.serviceDays;
    if (parsed.data.mergeWithExisting) {
      const prev = (existingDaysById.get(u.customerId) ?? []) as typeof u.serviceDays;
      const merged = Array.from(new Set([...prev, ...u.serviceDays]));
      nextDays = merged as typeof u.serviceDays;
    }
    const result = await db
      .update(customers)
      .set({ serviceDays: nextDays, updatedAt: new Date() })
      .where(
        and(eq(customers.id, u.customerId), eq(customers.tenantId, session.tenant.id)),
      )
      .returning({ id: customers.id });
    if (result.length > 0) updated++;
    else notFound++;
  }

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "tenant.update",
    entityType: "customers",
    summary: `Bulk assigned days to ${updated} customer${updated === 1 ? "" : "s"}`,
    payload: {
      updated,
      notFound,
      mergeWithExisting: parsed.data.mergeWithExisting ?? false,
    },
    headers: req.headers,
  });

  return NextResponse.json({ ok: true, updated, notFound });
}
