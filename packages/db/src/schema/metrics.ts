import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  date,
  timestamp,
  pgEnum,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const gaugeStatusEnum = pgEnum("gauge_status", [
  "healthy",
  "watch",
  "critical",
  "none",
]);

export const compositeGradeEnum = pgEnum("composite_grade", ["A", "B", "C", "D", "F"]);

/**
 * Daily snapshot of each tenant's four gauges + composite grade.
 * Inserted by /api/auto-rosie/run (or a nightly Inngest job).
 */
export const metricsSnapshots = pgTable(
  "metrics_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),

    paidScore: integer("paid_score"),
    paidStatus: gaugeStatusEnum("paid_status").notNull().default("none"),
    organicScore: integer("organic_score"),
    organicStatus: gaugeStatusEnum("organic_status").notNull().default("none"),
    websiteScore: integer("website_score"),
    websiteStatus: gaugeStatusEnum("website_status").notNull().default("none"),
    kpisScore: integer("kpis_score"),
    kpisStatus: gaugeStatusEnum("kpis_status").notNull().default("none"),

    compositeScore: integer("composite_score"),
    compositeGrade: compositeGradeEnum("composite_grade"),

    /** Pacing fact: e.g. "16 leads vs target of 13 — ahead by 23%". */
    pacingHeadline: text("pacing_headline"),

    /** Full per-input breakdown for the gauge cluster. */
    breakdown: jsonb("breakdown"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantDateIdx: uniqueIndex("metrics_tenant_date_idx").on(t.tenantId, t.snapshotDate),
    tenantCreatedIdx: index("metrics_tenant_created_idx").on(t.tenantId, t.createdAt),
  }),
);

export const autoRosieRunStatusEnum = pgEnum("auto_rosie_run_status", [
  "pending",
  "success",
  "failed",
  "skipped",
]);

/**
 * Audit log for every Auto-Rosie rule invocation.
 * `diff` records what changed in the DB; `undo_token` is the handle the UI
 * uses to revert a single run (Phase 5 wiring).
 */
export const autoRosieRuns = pgTable(
  "auto_rosie_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    ruleName: text("rule_name").notNull(),
    status: autoRosieRunStatusEnum("status").notNull().default("success"),

    inputs: jsonb("inputs"),
    outputs: jsonb("outputs"),
    diff: jsonb("diff"),
    undoToken: text("undo_token"),
    error: text("error"),

    relatedEntityType: text("related_entity_type"),
    relatedEntityId: uuid("related_entity_id"),
    /** When this run emitted an Action Plan item, link it. */
    actionId: uuid("action_id"),

    /** Token / cost telemetry when Claude was used. */
    usage: jsonb("usage").$type<{
      model?: string;
      inputTokens?: number;
      outputTokens?: number;
      cacheReadTokens?: number;
      costUsd?: number;
    }>(),

    durationMs: numeric("duration_ms", { precision: 10, scale: 0 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCreatedIdx: index("auto_rosie_runs_tenant_created_idx").on(t.tenantId, t.createdAt),
    tenantRuleIdx: index("auto_rosie_runs_tenant_rule_idx").on(t.tenantId, t.ruleName),
  }),
);

export type MetricsSnapshot = typeof metricsSnapshots.$inferSelect;
export type NewMetricsSnapshot = typeof metricsSnapshots.$inferInsert;
export type AutoRosieRun = typeof autoRosieRuns.$inferSelect;
export type NewAutoRosieRun = typeof autoRosieRuns.$inferInsert;
