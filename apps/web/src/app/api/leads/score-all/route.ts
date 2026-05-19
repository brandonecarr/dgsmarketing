import { NextResponse } from "next/server";
import { db, leads, messages, businessProfile } from "@rosie/db";
import { and, asc, eq, sql } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { dim, featurize, type LeadFeatureContext } from "@/lib/lead-scoring/features";
import { predict, train, type TrainedModel } from "@/lib/lead-scoring/train";

export const runtime = "nodejs";
export const maxDuration = 60;

const MIN_TRAIN_SIZE = 30;

/**
 * Trains a logistic regression on this tenant's closed leads (won/lost),
 * then scores all open leads. Scores are written back to `leads.score` (0–100).
 *
 * We persist the model on `business_profile.brandVoice` for now (Phase 6 we'll
 * add a dedicated `lead_score_models` table).
 */
export async function POST() {
  const session = await loadActiveSession();
  const all = await db
    .select()
    .from(leads)
    .where(eq(leads.tenantId, session.tenant.id));

  // Build per-lead context (message counts + timing) in one query.
  const stats = await db
    .select({
      leadId: messages.tenantId, // placeholder; replaced below
      conversationId: messages.conversationId,
      direction: messages.direction,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.tenantId, session.tenant.id))
    .orderBy(asc(messages.createdAt));

  // We have to join via conversations to get leadId. Do it in two passes to keep this simple.
  const { conversations } = await import("@rosie/db");
  const convRows = await db
    .select({ id: conversations.id, leadId: conversations.leadId })
    .from(conversations)
    .where(eq(conversations.tenantId, session.tenant.id));
  const convToLead = new Map(convRows.map((c) => [c.id, c.leadId]));

  const ctxByLead = new Map<string, LeadFeatureContext>();
  const firstOutboundByLead = new Map<string, Date>();
  const firstInboundByLead = new Map<string, Date>();
  for (const m of stats) {
    const leadId = convToLead.get(m.conversationId) ?? null;
    if (!leadId) continue;
    let ctx = ctxByLead.get(leadId);
    if (!ctx) {
      ctx = {
        outboundCount: 0,
        inboundCount: 0,
        hoursToFirstReply: null,
        duringBusinessHours: false,
        dayOfWeek: 0,
      };
      ctxByLead.set(leadId, ctx);
    }
    if (m.direction === "outbound") {
      ctx.outboundCount += 1;
      if (!firstOutboundByLead.has(leadId)) firstOutboundByLead.set(leadId, m.createdAt);
    } else {
      ctx.inboundCount += 1;
      if (!firstInboundByLead.has(leadId)) firstInboundByLead.set(leadId, m.createdAt);
    }
  }
  for (const lead of all) {
    const ctx = ctxByLead.get(lead.id) ?? {
      outboundCount: 0,
      inboundCount: 0,
      hoursToFirstReply: null,
      duringBusinessHours: false,
      dayOfWeek: 0,
    };
    const first = lead.firstContactAt ?? lead.createdAt;
    const firstOut = firstOutboundByLead.get(lead.id);
    ctx.hoursToFirstReply = firstOut ? (firstOut.getTime() - first.getTime()) / (60 * 60 * 1000) : null;
    const h = first.getUTCHours();
    ctx.duringBusinessHours = h >= 14 && h <= 23; // 9am–6pm Eastern as a rough heuristic
    ctx.dayOfWeek = first.getUTCDay();
    ctxByLead.set(lead.id, ctx);
  }

  // Train on closed leads.
  const trainSet = all
    .filter((l) => l.stage === "won" || l.stage === "lost")
    .map((l) => ({
      x: featurize(l, ctxByLead.get(l.id)!).values,
      y: l.stage === "won" ? (1 as const) : (0 as const),
    }));

  let model: TrainedModel | null = null;
  if (trainSet.length >= MIN_TRAIN_SIZE) {
    model = train(trainSet, { dim: dim() });
  }

  // Score all open leads.
  const openLeads = all.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const updates: Array<Promise<unknown>> = [];
  let scored = 0;
  for (const lead of openLeads) {
    const x = featurize(lead, ctxByLead.get(lead.id)!).values;
    const p = model ? predict(model, x) : leadHeuristicScore(lead, ctxByLead.get(lead.id)!);
    const score = Math.round(p * 100);
    if (lead.score !== score) {
      updates.push(
        db
          .update(leads)
          .set({ score, updatedAt: new Date() })
          .where(eq(leads.id, lead.id)),
      );
      scored += 1;
    }
  }
  await Promise.all(updates);

  // Persist model alongside brand voice for now.
  if (model) {
    await db
      .update(businessProfile)
      .set({
        brandVoice: sql`coalesce(brand_voice, '{}'::jsonb) || ${JSON.stringify({
          _leadScoreModel: model,
        })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(businessProfile.tenantId, session.tenant.id));
  }

  return NextResponse.json({
    ok: true,
    trainSize: model?.trainSize ?? trainSet.length,
    minRequired: MIN_TRAIN_SIZE,
    accuracy: model?.accuracy ?? null,
    scoredLeads: scored,
    usingHeuristic: !model,
  });
}

function leadHeuristicScore(
  lead: import("@rosie/db").Lead,
  ctx: LeadFeatureContext,
): number {
  // Fallback rules when the trainer doesn't have enough data yet.
  let score = 0.35;
  if (lead.stage === "engaged") score += 0.1;
  if (lead.stage === "quoted") score += 0.2;
  if (lead.stage === "qualified") score += 0.3;
  if (lead.stage === "booked") score += 0.4;
  if (ctx.inboundCount > 2) score += 0.05;
  if (ctx.hoursToFirstReply !== null && ctx.hoursToFirstReply < 1) score += 0.1;
  if (ctx.duringBusinessHours) score += 0.03;
  return Math.max(0, Math.min(1, score));
}

export async function GET() {
  return POST();
}
