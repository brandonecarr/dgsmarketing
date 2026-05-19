import type { Lead } from "@rosie/db";

/**
 * Lightweight feature engineering for predictive lead score.
 * Produces a fixed-length numeric vector from a lead row + thread stats.
 *
 * Stay simple here: features are linear or one-hot. We can swap to xgboost later.
 */
export interface LeadFeatureContext {
  /** Hours from first contact to the first outbound reply. null if no reply yet. */
  hoursToFirstReply: number | null;
  /** Total outbound messages so far. */
  outboundCount: number;
  /** Total inbound messages so far. */
  inboundCount: number;
  /** Whether the lead arrived during business hours (9-18 local time). */
  duringBusinessHours: boolean;
  /** Day of week the lead was created (0=Sunday). */
  dayOfWeek: number;
}

const SOURCE_BUCKETS = ["sms_inbound", "fb_lead_form", "web_form", "make_webhook", "manual", "import"] as const;

export interface FeatureVector {
  values: number[];
  labels: string[];
}

export const FEATURE_LABELS = [
  "intercept",
  "log1p_outbound",
  "log1p_inbound",
  "hours_to_first_reply_norm",
  "no_reply_yet",
  "during_business_hours",
  "dow_weekend",
  ...SOURCE_BUCKETS.map((s) => `source_${s}`),
];

export function featurize(lead: Lead, ctx: LeadFeatureContext): FeatureVector {
  const f: number[] = [1]; // intercept
  f.push(Math.log1p(ctx.outboundCount));
  f.push(Math.log1p(ctx.inboundCount));
  f.push(ctx.hoursToFirstReply === null ? 0 : Math.min(ctx.hoursToFirstReply, 72) / 72);
  f.push(ctx.hoursToFirstReply === null ? 1 : 0);
  f.push(ctx.duringBusinessHours ? 1 : 0);
  f.push(ctx.dayOfWeek === 0 || ctx.dayOfWeek === 6 ? 1 : 0);
  for (const s of SOURCE_BUCKETS) f.push(lead.source === s ? 1 : 0);
  return { values: f, labels: FEATURE_LABELS };
}

export function dim(): number {
  return FEATURE_LABELS.length;
}
