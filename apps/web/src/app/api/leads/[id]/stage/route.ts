import { NextResponse } from "next/server";
import { z } from "zod";
import { db, leads, STAGE_ORDER } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { fireWonConversion } from "@/lib/conversions/fire";
import { enrollLead } from "@/lib/cadences/engine";

export const runtime = "nodejs";

const Body = z.object({
  stage: z.enum(STAGE_ORDER),
  /** Optional deal value to send to ad platforms with the conversion. */
  value: z.number().optional(),
  currency: z.string().length(3).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const [before] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.tenantId, session.tenant.id)))
    .limit(1);
  if (!before) return NextResponse.json({ error: "not found" }, { status: 404 });

  const now = new Date();
  const patch: {
    stage: (typeof STAGE_ORDER)[number];
    updatedAt: Date;
    wonAt?: Date;
    lostAt?: Date;
  } = {
    stage: parsed.data.stage,
    updatedAt: now,
  };
  if (parsed.data.stage === "won") patch.wonAt = now;
  if (parsed.data.stage === "lost") patch.lostAt = now;

  const [updated] = await db
    .update(leads)
    .set(patch)
    .where(and(eq(leads.id, id), eq(leads.tenantId, session.tenant.id)))
    .returning();
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Server-side conversion on the won transition only.
  let conversions: Awaited<ReturnType<typeof fireWonConversion>> | undefined;
  if (parsed.data.stage === "won" && before.stage !== "won") {
    try {
      conversions = await fireWonConversion(
        {
          id: updated.id,
          tenantId: updated.tenantId,
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          attribution: updated.attribution ?? null,
          wonAt: updated.wonAt ?? now,
        },
        {
          eventName: "Lead",
          value: parsed.data.value,
          currency: parsed.data.currency,
          source: "lead_stage",
        },
      );
    } catch (e) {
      console.error("conversion fire failed", e);
    }
  }

  // Stage-change cadence trigger.
  if (before.stage !== updated.stage) {
    enrollLead({
      tenantId: session.tenant.id,
      leadId: updated.id,
      trigger: "stage_change",
      stage: updated.stage,
    }).catch((e) => console.error("cadence enroll failed", e));
  }

  return NextResponse.json({
    ok: true,
    id: updated.id,
    stage: updated.stage,
    conversions: conversions?.map((c) => ({
      platform: c.platform,
      status: c.status,
      error: c.error,
    })),
  });
}
