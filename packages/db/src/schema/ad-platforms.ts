import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  pgEnum,
  numeric,
  integer,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const adPlatformEnum = pgEnum("ad_platform", ["meta", "google_ads", "tiktok"]);

export const adCampaignStatusEnum = pgEnum("ad_campaign_status", [
  "active",
  "paused",
  "archived",
  "deleted",
  "draft",
  "in_review",
  "unknown",
]);

/**
 * One row per (tenant, platform, external account). A tenant can have multiple
 * ad accounts on the same platform (agency-managed multi-account setups).
 */
export const adAccounts = pgTable(
  "ad_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    platform: adPlatformEnum("platform").notNull(),
    /** Provider account id, e.g. `act_1234567890` for Meta. */
    externalId: text("external_id").notNull(),
    name: text("name"),
    currency: text("currency"),
    timezone: text("timezone"),
    /** Provider-side status (active / disabled / closed / etc.). */
    status: text("status"),
    raw: jsonb("raw"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantPlatformIdx: index("ad_accounts_tenant_platform_idx").on(t.tenantId, t.platform),
    platformExternalIdx: uniqueIndex("ad_accounts_platform_external_idx").on(
      t.platform,
      t.externalId,
    ),
  }),
);

export const adCampaigns = pgTable(
  "ad_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => adAccounts.id, { onDelete: "cascade" }),
    platform: adPlatformEnum("platform").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name"),
    objective: text("objective"),
    status: adCampaignStatusEnum("status").notNull().default("unknown"),
    /** Daily budget in account currency units (cents/lowest), if defined. */
    dailyBudget: numeric("daily_budget", { precision: 14, scale: 4 }),
    /** Lifetime budget in account currency units, if defined. */
    lifetimeBudget: numeric("lifetime_budget", { precision: 14, scale: 4 }),
    raw: jsonb("raw"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantPlatformIdx: index("ad_campaigns_tenant_platform_idx").on(t.tenantId, t.platform),
    platformExternalIdx: uniqueIndex("ad_campaigns_platform_external_idx").on(
      t.platform,
      t.externalId,
    ),
  }),
);

/**
 * Daily roll-up of ad-platform metrics, one row per (campaign, day). Powers the
 * Paid gauge and the per-platform reports.
 */
export const adMetricsDaily = pgTable(
  "ad_metrics_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => adAccounts.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => adCampaigns.id, { onDelete: "set null" }),
    platform: adPlatformEnum("platform").notNull(),
    date: date("date").notNull(),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    spendUsd: numeric("spend_usd", { precision: 12, scale: 4 }).notNull().default("0"),
    conversions: integer("conversions").notNull().default(0),
    /** Platform-reported revenue if available (e.g. Meta Lead Quality value). */
    revenueUsd: numeric("revenue_usd", { precision: 14, scale: 4 }).notNull().default("0"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    campaignDateIdx: uniqueIndex("ad_metrics_campaign_date_idx").on(t.campaignId, t.date),
    tenantDateIdx: index("ad_metrics_tenant_date_idx").on(t.tenantId, t.date),
    platformDateIdx: index("ad_metrics_platform_date_idx").on(t.platform, t.date),
  }),
);

export type AdAccount = typeof adAccounts.$inferSelect;
export type NewAdAccount = typeof adAccounts.$inferInsert;
export type AdCampaign = typeof adCampaigns.$inferSelect;
export type NewAdCampaign = typeof adCampaigns.$inferInsert;
export type AdMetricsDaily = typeof adMetricsDaily.$inferSelect;
export type NewAdMetricsDaily = typeof adMetricsDaily.$inferInsert;
