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
import { leads } from "./leads";

export const conversionPlatformEnum = pgEnum("conversion_platform", [
  "meta",
  "google_ads",
  "tiktok",
]);

export const conversionStatusEnum = pgEnum("conversion_status", [
  "queued",
  "sent",
  "failed",
  "skipped",
]);

/**
 * Every server-side conversion attempt. Lets us audit, retry, and report on
 * downstream platform sends without re-querying each ad network.
 */
export const conversionEvents = pgTable(
  "conversion_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    platform: conversionPlatformEnum("platform").notNull(),
    eventName: text("event_name").notNull(),
    /** Shared dedup id matching the original client-side event. */
    eventId: text("event_id").notNull(),
    status: conversionStatusEnum("status").notNull().default("queued"),
    value: numeric("value", { precision: 12, scale: 2 }),
    currency: text("currency").default("USD"),
    requestPayload: jsonb("request_payload"),
    responsePayload: jsonb("response_payload"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCreatedIdx: index("conv_events_tenant_created_idx").on(
      t.tenantId,
      t.createdAt,
    ),
    leadPlatformIdx: index("conv_events_lead_platform_idx").on(t.leadId, t.platform),
  }),
);

export type ConversionEvent = typeof conversionEvents.$inferSelect;
export type NewConversionEvent = typeof conversionEvents.$inferInsert;
