import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/**
 * Slow operations log. The instrumented db helper writes here whenever a
 * single SQL call exceeds the configured threshold (default 250 ms).
 *
 * Not RLS-scoped — Phase 15 perf page is operator-internal, plus tenantId
 * is nullable for ops that run before a tenant is resolved (auth, webhooks).
 */
export const slowQueries = pgTable(
  "slow_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    durationMs: integer("duration_ms").notNull(),
    /** Truncated SQL preview (first 500 chars). */
    sqlPreview: text("sql_preview"),
    /** Request path that triggered the query. */
    path: text("path"),
    /** Extra context (params count, bindings dropped, etc.). */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index("slow_queries_created_idx").on(t.createdAt),
    durationIdx: index("slow_queries_duration_idx").on(t.durationMs),
  }),
);

/**
 * Browser-reported Core Web Vitals + page paint timings. One row per metric
 * the browser emits via `/api/perf/vitals` (LCP, INP, CLS, FCP, TTFB).
 */
export const webVitals = pgTable(
  "web_vitals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    /** "LCP" | "INP" | "CLS" | "FCP" | "TTFB" */
    metric: text("metric").notNull(),
    /** Metric value — LCP/INP/FCP/TTFB in ms, CLS unitless. */
    value: integer("value").notNull(),
    rating: text("rating"), // "good" | "needs-improvement" | "poor"
    path: text("path"),
    deviceType: text("device_type"), // "mobile" | "desktop"
    /** Network info (effectiveType "4g"/"3g"). */
    connection: text("connection"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index("web_vitals_created_idx").on(t.createdAt),
    metricIdx: index("web_vitals_metric_idx").on(t.metric, t.createdAt),
  }),
);

export type SlowQuery = typeof slowQueries.$inferSelect;
export type NewSlowQuery = typeof slowQueries.$inferInsert;
export type WebVital = typeof webVitals.$inferSelect;
export type NewWebVital = typeof webVitals.$inferInsert;
