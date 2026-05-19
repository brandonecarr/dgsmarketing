import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const kpiTypeEnum = pgEnum("kpi_type", [
  "leads_per_month",
  "revenue_per_month",
  "cost_per_lead",
  "close_rate",
  "appointments_per_week",
  "reviews_per_month",
  "custom",
]);

export const kpiPeriodEnum = pgEnum("kpi_period", ["weekly", "monthly", "quarterly"]);

/** Operator-defined target for a metric (e.g. "30 leads / month"). */
export const kpis = pgTable(
  "kpis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: kpiTypeEnum("type").notNull(),
    period: kpiPeriodEnum("period").notNull().default("monthly"),
    targetValue: numeric("target_value", { precision: 12, scale: 2 }).notNull(),
    /** "higher_better" or "lower_better". cost_per_lead is lower_better. */
    direction: text("direction").notNull().default("higher_better"),
    unit: text("unit"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("kpis_tenant_idx").on(t.tenantId),
  }),
);

/** Computed actuals for a KPI over a period. One row per (kpi, period_start). */
export const kpiValues = pgTable(
  "kpi_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    kpiId: uuid("kpi_id")
      .notNull()
      .references(() => kpis.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    actualValue: numeric("actual_value", { precision: 12, scale: 2 }).notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    kpiPeriodIdx: uniqueIndex("kpi_values_kpi_period_idx").on(t.kpiId, t.periodStart),
    tenantPeriodIdx: index("kpi_values_tenant_period_idx").on(t.tenantId, t.periodStart),
  }),
);

export type Kpi = typeof kpis.$inferSelect;
export type NewKpi = typeof kpis.$inferInsert;
export type KpiValue = typeof kpiValues.$inferSelect;
export type NewKpiValue = typeof kpiValues.$inferInsert;
