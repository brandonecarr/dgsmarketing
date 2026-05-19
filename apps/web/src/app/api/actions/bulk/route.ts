import { NextResponse } from "next/server";
import { z } from "zod";
import { db, actions } from "@rosie/db";
import { and, eq, inArray } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  status: z.enum(["done", "dismissed", "snoozed", "in_progress"]),
  snoozedUntil: z.string().datetime().optional(),
});

/**
 * Bulk-update a batch of `actions` rows. Used by the /review page's
 * "Approve all" button + the dismiss-all keyboard shortcut.
 */
export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const patch: Record<string, unknown> = {
    status: parsed.data.status,
    updatedAt: new Date(),
  };
  if (parsed.data.status === "done") patch.completedAt = new Date();
  if (parsed.data.status === "snoozed" && parsed.data.snoozedUntil) {
    patch.snoozedUntil = new Date(parsed.data.snoozedUntil);
  }

  const updated = await db
    .update(actions)
    .set(patch)
    .where(
      and(
        eq(actions.tenantId, session.tenant.id),
        inArray(actions.id, parsed.data.ids),
      ),
    )
    .returning({ id: actions.id });

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "tenant.update",
    entityType: "actions",
    summary: `Bulk ${parsed.data.status} on ${updated.length} action${updated.length === 1 ? "" : "s"}`,
    payload: { count: updated.length, status: parsed.data.status },
    headers: req.headers,
  });

  return NextResponse.json({ ok: true, count: updated.length });
}
