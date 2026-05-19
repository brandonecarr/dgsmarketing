import { NextResponse } from "next/server";
import { z } from "zod";
import { db, cadences } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Step = z.object({
  delayHours: z.number().int().min(0).max(720),
  action: z.enum(["send_sms", "create_action"]),
  body: z.string().min(1).max(800),
  priority: z.number().int().min(1).max(10).optional(),
});

const Body = z.object({
  name: z.string().min(1).max(120),
  trigger: z.enum(["lead_created", "stage_change", "manual"]).default("manual"),
  triggerStage: z.string().max(40).optional(),
  steps: z.array(Step).min(1).max(20),
  enabled: z.boolean().optional(),
  stopOnReply: z.boolean().optional(),
});

export const runtime = "nodejs";

export async function GET() {
  const session = await loadActiveSession();
  const rows = await db
    .select()
    .from(cadences)
    .where(eq(cadences.tenantId, session.tenant.id))
    .orderBy(desc(cadences.createdAt));
  return NextResponse.json({ cadences: rows });
}

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const [row] = await db
    .insert(cadences)
    .values({
      tenantId: session.tenant.id,
      name: parsed.data.name,
      trigger: parsed.data.trigger,
      triggerStage: parsed.data.triggerStage,
      steps: parsed.data.steps,
      enabled: parsed.data.enabled ?? true,
      stopOnReply: parsed.data.stopOnReply ?? true,
    })
    .returning();
  return NextResponse.json({ ok: true, cadence: row });
}
