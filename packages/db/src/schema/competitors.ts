import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const competitorSignalKindEnum = pgEnum("competitor_signal_kind", [
  "new_ad",
  "ad_paused",
  "photo_added",
  "hours_changed",
  "review_burst",
  "post_published",
  "domain_changed",
  "note",
]);

export const competitors = pgTable(
  "competitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain"),
    gbpUrl: text("gbp_url"),
    metaPageId: text("meta_page_id"),
    notes: text("notes"),
    lastScanAt: timestamp("last_scan_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("competitors_tenant_idx").on(t.tenantId),
  }),
);

export const competitorSignals = pgTable(
  "competitor_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    competitorId: uuid("competitor_id")
      .notNull()
      .references(() => competitors.id, { onDelete: "cascade" }),
    kind: competitorSignalKindEnum("kind").notNull(),
    summary: text("summary").notNull(),
    /** Source data: ad copy, photo URL, hours diff, etc. */
    payload: jsonb("payload"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantObservedIdx: index("competitor_signals_tenant_observed_idx").on(
      t.tenantId,
      t.observedAt,
    ),
    competitorObservedIdx: index("competitor_signals_competitor_observed_idx").on(
      t.competitorId,
      t.observedAt,
    ),
  }),
);

export type Competitor = typeof competitors.$inferSelect;
export type NewCompetitor = typeof competitors.$inferInsert;
export type CompetitorSignal = typeof competitorSignals.$inferSelect;
