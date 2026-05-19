import { NextResponse } from "next/server";
import { z } from "zod";
import { db, actions } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Patch = z.object({
  status: z
    .enum(["open", "in_progress", "done", "dismissed", "snoozed"])
    .optional(),
  snoozedUntil: z.string().datetime().nullable().optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
});

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.status !== undefined) {
    patch.status = parsed.data.status;
    if (parsed.data.status === "done") patch.completedAt = new Date();
  }
  if (parsed.data.snoozedUntil !== undefined) {
    patch.snoozedUntil = parsed.data.snoozedUntil ? new Date(parsed.data.snoozedUntil) : null;
  }
  if (parsed.data.assigneeUserId !== undefined) {
    patch.assigneeUserId = parsed.data.assigneeUserId;
  }

  const result = await db
    .update(actions)
    .set(patch)
    .where(and(eq(actions.id, id), eq(actions.tenantId, session.tenant.id)))
    .returning();
  if (!result[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, action: result[0] });
}
