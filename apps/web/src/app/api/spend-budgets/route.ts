import { NextResponse } from "next/server";
import { z } from "zod";
import { db, spendBudgets } from "@rosie/db";
import { eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { getMonthlySpend } from "@/lib/usage";

const Body = z.object({
  llmUsdCap: z.number().nullable().optional(),
  smsCap: z.number().nullable().optional(),
  imageCap: z.number().nullable().optional(),
  voiceMinutesCap: z.number().nullable().optional(),
  hardBlock: z.boolean().optional(),
});

export const runtime = "nodejs";

export async function GET() {
  const session = await loadActiveSession();
  const [budget] = await db
    .select()
    .from(spendBudgets)
    .where(eq(spendBudgets.tenantId, session.tenant.id))
    .limit(1);
  const spend = await getMonthlySpend(session.tenant.id);
  return NextResponse.json({ budget, spend });
}

export async function PUT(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const payload = parsed.data;

  const patch = {
    llmUsdCap: payload.llmUsdCap === null ? null : payload.llmUsdCap?.toString(),
    smsCap: payload.smsCap === null ? null : payload.smsCap?.toString(),
    imageCap: payload.imageCap === null ? null : payload.imageCap?.toString(),
    voiceMinutesCap:
      payload.voiceMinutesCap === null ? null : payload.voiceMinutesCap?.toString(),
    hardBlock: payload.hardBlock === undefined ? undefined : payload.hardBlock ? "true" : "false",
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ tenantId: spendBudgets.tenantId })
    .from(spendBudgets)
    .where(eq(spendBudgets.tenantId, session.tenant.id))
    .limit(1);

  if (existing) {
    await db.update(spendBudgets).set(patch).where(eq(spendBudgets.tenantId, session.tenant.id));
  } else {
    await db.insert(spendBudgets).values({ tenantId: session.tenant.id, ...patch });
  }
  return NextResponse.json({ ok: true });
}
