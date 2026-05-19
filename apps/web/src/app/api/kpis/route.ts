import { NextResponse } from "next/server";
import { z } from "zod";
import { db, kpis } from "@rosie/db";
import { eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const KPI_TYPES = [
  "leads_per_month",
  "revenue_per_month",
  "cost_per_lead",
  "close_rate",
  "appointments_per_week",
  "reviews_per_month",
  "custom",
] as const;

const Body = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(KPI_TYPES),
  period: z.enum(["weekly", "monthly", "quarterly"]).default("monthly"),
  targetValue: z.number().positive(),
  direction: z.enum(["higher_better", "lower_better"]).default("higher_better"),
  unit: z.string().max(40).optional(),
});

export const runtime = "nodejs";

export async function GET() {
  const session = await loadActiveSession();
  const rows = await db.select().from(kpis).where(eq(kpis.tenantId, session.tenant.id));
  return NextResponse.json({ kpis: rows });
}

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const [row] = await db
    .insert(kpis)
    .values({
      tenantId: session.tenant.id,
      name: parsed.data.name,
      type: parsed.data.type,
      period: parsed.data.period,
      targetValue: parsed.data.targetValue.toString(),
      direction: parsed.data.direction,
      unit: parsed.data.unit,
    })
    .returning();
  return NextResponse.json({ ok: true, kpi: row });
}
