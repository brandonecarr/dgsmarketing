import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  pgEnum,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const usageKindEnum = pgEnum("usage_kind", [
  "llm_tokens",
  "llm_request",
  "sms_sent",
  "sms_received",
  "image_generated",
  "voice_minutes",
]);

/**
 * Every billable event. Aggregated by the spend governor + reported to Stripe
 * (metered prices) by `/api/billing/report-usage`.
 */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    kind: usageKindEnum("kind").notNull(),
    /** Quantity (tokens, messages, images, minutes). */
    units: numeric("units", { precision: 14, scale: 3 }).notNull(),
    /** Estimated USD cost. */
    costUsd: numeric("cost_usd", { precision: 10, scale: 4 }).notNull().default("0"),
    /** Underlying model / provider for breakdown reporting. */
    model: text("model"),
    /** Where this fired from: rosie_chat, agent, send_sms, image_creator, etc. */
    source: text("source"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Set after we've reported this row to Stripe's metered billing. */
    reportedAt: timestamp("reported_at", { withTimezone: true }),
  },
  (t) => ({
    tenantCreatedIdx: index("usage_tenant_created_idx").on(t.tenantId, t.createdAt),
    tenantKindCreatedIdx: index("usage_tenant_kind_created_idx").on(
      t.tenantId,
      t.kind,
      t.createdAt,
    ),
    unreportedIdx: index("usage_unreported_idx").on(t.reportedAt),
  }),
);

/**
 * Per-tenant monthly hard caps. Set to NULL to allow unlimited.
 * The spend governor refuses gated calls when (current month's spend ≥ cap).
 */
export const spendBudgets = pgTable("spend_budgets", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  llmUsdCap: numeric("llm_usd_cap", { precision: 10, scale: 2 }),
  smsCap: numeric("sms_cap", { precision: 10, scale: 0 }),
  imageCap: numeric("image_cap", { precision: 10, scale: 0 }),
  voiceMinutesCap: numeric("voice_minutes_cap", { precision: 10, scale: 0 }),
  /** When true, requests are refused at the cap; false means warn-only. */
  hardBlock: text("hard_block").notNull().default("true"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
export type SpendBudget = typeof spendBudgets.$inferSelect;
export type NewSpendBudget = typeof spendBudgets.$inferInsert;
