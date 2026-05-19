export type RuleName =
  | "review_after_won"
  | "followup_after_quoted_24h"
  | "pause_zero_conv"
  | "no_recent_post"
  | "gauge_slipping";

export interface RuleContext {
  tenantId: string;
  now: Date;
}

export interface RuleEmission {
  /** Action to create on the Action Plan. */
  action: {
    title: string;
    body: string;
    priority: number;
    source: import("@rosie/db").Action["source"];
    metadata?: Record<string, unknown>;
    relatedEntityType?: string;
    relatedEntityId?: string;
  };
}

export interface RuleResult {
  rule: RuleName;
  emissions: RuleEmission[];
  /** Free-form inputs we read from the DB; logged into auto_rosie_runs. */
  inputs?: Record<string, unknown>;
  /** Anything we did (or would have done) other than emitting actions. */
  diff?: Record<string, unknown>;
  skipReason?: string;
  durationMs: number;
}

export interface Rule {
  name: RuleName;
  run(ctx: RuleContext): Promise<RuleResult>;
}
