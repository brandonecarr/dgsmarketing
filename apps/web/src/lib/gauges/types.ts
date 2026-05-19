export type GaugeKey = "paid" | "organic" | "website" | "kpis";
export type GaugeStatus = "healthy" | "watch" | "critical" | "none";
export type CompositeGrade = "A" | "B" | "C" | "D" | "F";

export interface GaugeResult {
  key: GaugeKey;
  /** 0–100 or null if there isn't enough data to score. */
  score: number | null;
  status: GaugeStatus;
  /** One-line "what's happening" headline shown on the gauge card. */
  headline: string;
  /** The single highest-leverage next move for this gauge. */
  fixNext: string;
  /** Per-input breakdown for the deep-dive view. */
  inputs: Array<{ label: string; value: string; ok: boolean | null }>;
}

export interface GaugeCluster {
  paid: GaugeResult;
  organic: GaugeResult;
  website: GaugeResult;
  kpis: GaugeResult;
  /** 0–100, average of scored gauges (gauges with score=null are ignored). */
  composite: number | null;
  grade: CompositeGrade | null;
  /** Pacing fact: "16 leads vs target of 13 — ahead by 23%". */
  pacingHeadline: string | null;
}

export function gradeFromScore(score: number | null): CompositeGrade | null {
  if (score === null) return null;
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function statusFromScore(score: number | null): GaugeStatus {
  if (score === null) return "none";
  if (score >= 75) return "healthy";
  if (score >= 50) return "watch";
  return "critical";
}
