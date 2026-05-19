import { NextResponse } from "next/server";
import { z } from "zod";
import { db, kpis } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  targetValue: z.number().positive().optional(),
  direction: z.enum(["higher_better", "lower_better"]).optional(),
  unit: z.string().max(40).optional(),
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
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.targetValue !== undefined)
    patch.targetValue = parsed.data.targetValue.toString();
  if (parsed.data.direction !== undefined) patch.direction = parsed.data.direction;
  if (parsed.data.unit !== undefined) patch.unit = parsed.data.unit;

  const result = await db
    .update(kpis)
    .set(patch)
    .where(and(eq(kpis.id, id), eq(kpis.tenantId, session.tenant.id)))
    .returning();
  if (!result[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, kpi: result[0] });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  await db.delete(kpis).where(and(eq(kpis.id, id), eq(kpis.tenantId, session.tenant.id)));
  return NextResponse.json({ ok: true });
}
