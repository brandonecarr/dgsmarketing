import { db, usageEvents, spendBudgets, sql } from "@rosie/db";
import { and, eq, gte, isNull } from "@rosie/db";
import { pushUsageEvent } from "./tinybird";

export type UsageKind =
  | "llm_tokens"
  | "llm_request"
  | "sms_sent"
  | "sms_received"
  | "image_generated"
  | "voice_minutes";

/**
 * Rough USD cost per 1M tokens by model. Used by the governor so we can budget
 * in plain dollars rather than per-model token counts. Sources: each provider's
 * public pricing as of model release; refresh when prices change.
 */
const TOKEN_COSTS_USD_PER_M: Record<string, { input: number; output: number }> = {
  "claude-opus-4-7": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
};

const IMAGE_COST_USD = Number(process.env.ROSIE_IMAGE_UNIT_COST_USD ?? 0.04);

export function estimateLlmCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = TOKEN_COSTS_USD_PER_M[model];
  if (!rate) return 0;
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
}

interface RecordOpts {
  tenantId: string;
  kind: UsageKind;
  units: number;
  costUsd?: number;
  model?: string;
  source?: string;
  meta?: Record<string, unknown>;
}

export async function recordUsage(opts: RecordOpts): Promise<void> {
  try {
    await db.insert(usageEvents).values({
      tenantId: opts.tenantId,
      kind: opts.kind,
      units: opts.units.toString(),
      costUsd: (opts.costUsd ?? 0).toString(),
      model: opts.model,
      source: opts.source,
      meta: opts.meta,
    });
  } catch (e) {
    // Usage logging must never block the caller.
    console.error("recordUsage failed", e);
  }
  // Mirror to Tinybird for fast roll-ups; no-ops when not configured.
  pushUsageEvent({
    tenant_id: opts.tenantId,
    kind: opts.kind,
    units: opts.units,
    cost_usd: opts.costUsd ?? 0,
    model: opts.model ?? null,
    source: opts.source ?? null,
  }).catch((e) => console.error("tinybird usage push failed", e));
}

/** Convenience wrapper for LLM calls. */
export async function recordLlmUsage(
  tenantId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  source: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  const cost = estimateLlmCostUsd(model, inputTokens, outputTokens);
  await Promise.all([
    recordUsage({
      tenantId,
      kind: "llm_tokens",
      units: inputTokens + outputTokens,
      costUsd: cost,
      model,
      source,
      meta: { inputTokens, outputTokens, ...meta },
    }),
    recordUsage({
      tenantId,
      kind: "llm_request",
      units: 1,
      costUsd: 0,
      model,
      source,
    }),
  ]);
}

export interface MonthlySpend {
  llmUsd: number;
  smsSent: number;
  imagesGenerated: number;
  voiceMinutes: number;
  totalUsd: number;
}

export async function getMonthlySpend(tenantId: string): Promise<MonthlySpend> {
  const now = new Date();
  const ms = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await db
    .select({
      kind: usageEvents.kind,
      units: sql<string>`coalesce(sum(${usageEvents.units}), 0)::text`,
      cost: sql<string>`coalesce(sum(${usageEvents.costUsd}), 0)::text`,
    })
    .from(usageEvents)
    .where(and(eq(usageEvents.tenantId, tenantId), gte(usageEvents.createdAt, ms)))
    .groupBy(usageEvents.kind);

  let llmUsd = 0;
  let smsSent = 0;
  let imagesGenerated = 0;
  let voiceMinutes = 0;
  for (const r of rows) {
    const units = Number(r.units);
    const cost = Number(r.cost);
    if (r.kind === "llm_tokens" || r.kind === "llm_request") llmUsd += cost;
    if (r.kind === "sms_sent") smsSent += units;
    if (r.kind === "image_generated") {
      imagesGenerated += units;
      llmUsd += cost; // images bill against the same dollar bucket
    }
    if (r.kind === "voice_minutes") voiceMinutes += units;
  }
  // Add SMS cost rough at $0.01/msg (Twilio US baseline).
  const smsUsd = smsSent * Number(process.env.ROSIE_SMS_UNIT_COST_USD ?? 0.01);
  const totalUsd = llmUsd + smsUsd;
  return { llmUsd, smsSent, imagesGenerated, voiceMinutes, totalUsd };
}

export interface GovernorVerdict {
  allowed: boolean;
  reason?: string;
  spend: MonthlySpend;
  caps: {
    llmUsdCap: number | null;
    smsCap: number | null;
    imageCap: number | null;
  };
}

interface CheckOpts {
  tenantId: string;
  kind: "llm" | "sms" | "image";
  /** Estimated additional units about to be consumed. */
  units?: number;
  /** Estimated additional USD about to be consumed (for llm/image). */
  costUsd?: number;
}

/**
 * Hard-block check before a gated operation. Allows over-cap when the tenant
 * explicitly set hard_block=false. SMS/image caps are unit-based; LLM is dollar-based.
 */
export async function checkBudget(opts: CheckOpts): Promise<GovernorVerdict> {
  const [budget] = await db
    .select()
    .from(spendBudgets)
    .where(eq(spendBudgets.tenantId, opts.tenantId))
    .limit(1);
  const spend = await getMonthlySpend(opts.tenantId);

  const caps = {
    llmUsdCap: budget?.llmUsdCap ? Number(budget.llmUsdCap) : null,
    smsCap: budget?.smsCap ? Number(budget.smsCap) : null,
    imageCap: budget?.imageCap ? Number(budget.imageCap) : null,
  };
  const hardBlock = (budget?.hardBlock ?? "true") === "true";

  if (opts.kind === "llm" && caps.llmUsdCap !== null) {
    const projected = spend.llmUsd + (opts.costUsd ?? 0);
    if (projected > caps.llmUsdCap && hardBlock) {
      return {
        allowed: false,
        reason: `LLM budget cap reached for this month ($${caps.llmUsdCap}). Raise it on /settings → Spend.`,
        spend,
        caps,
      };
    }
  }
  if (opts.kind === "sms" && caps.smsCap !== null) {
    const projected = spend.smsSent + (opts.units ?? 1);
    if (projected > caps.smsCap && hardBlock) {
      return {
        allowed: false,
        reason: `SMS cap reached (${caps.smsCap}/mo).`,
        spend,
        caps,
      };
    }
  }
  if (opts.kind === "image" && caps.imageCap !== null) {
    const projected = spend.imagesGenerated + (opts.units ?? 1);
    if (projected > caps.imageCap && hardBlock) {
      return {
        allowed: false,
        reason: `Image generation cap reached (${caps.imageCap}/mo).`,
        spend,
        caps,
      };
    }
  }
  return { allowed: true, spend, caps };
}

/** Fetch unreported usage rows in chunks for the Stripe metered-billing job. */
export async function unreportedUsage(tenantId: string, limit = 500) {
  return await db
    .select()
    .from(usageEvents)
    .where(and(eq(usageEvents.tenantId, tenantId), isNull(usageEvents.reportedAt)))
    .limit(limit);
}
