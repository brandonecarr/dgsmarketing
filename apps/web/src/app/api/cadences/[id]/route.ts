import { NextResponse } from "next/server";
import { z } from "zod";
import { db, cadences } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  stopOnReply: z.boolean().optional(),
  trigger: z.enum(["lead_created", "stage_change", "manual"]).optional(),
  triggerStage: z.string().max(40).nullable().optional(),
  steps: z
    .array(
      z.object({
        delayHours: z.number().int().min(0).max(720),
        action: z.enum(["send_sms", "create_action"]),
        body: z.string().min(1).max(800),
        priority: z.number().int().min(1).max(10).optional(),
      }),
    )
    .min(1)
    .max(20)
    .optional(),
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
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) patch[k] = v;
  }
  const [row] = await db
    .update(cadences)
    .set(patch)
    .where(and(eq(cadences.id, id), eq(cadences.tenantId, session.tenant.id)))
    .returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, cadence: row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  await db.delete(cadences).where(and(eq(cadences.id, id), eq(cadences.tenantId, session.tenant.id)));
  return NextResponse.json({ ok: true });
}
