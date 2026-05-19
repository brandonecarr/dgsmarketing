import { pgTable, uuid, text, jsonb, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const integrationProviderEnum = pgEnum("integration_provider", [
  "quo",
  "openphone",
  "google",
  "google_ads",
  "meta",
  "tiktok",
  "make",
  "stripe",
  "vapi",
]);

/**
 * One row per (tenant, provider) holding connection state + secrets.
 * `secrets` is encrypted at the application layer before insert (added in Phase 6).
 */
export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),
    status: text("status").notNull().default("disconnected"),
    /** Non-secret config (e.g. selected Quo number, OpenPhone phone id). */
    config: jsonb("config").$type<Record<string, unknown>>(),
    /** Encrypted credential blob. */
    secrets: jsonb("secrets").$type<Record<string, unknown>>(),
    /** Webhook signing secret if the provider supports per-tenant secrets. */
    webhookSecret: text("webhook_secret"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantProviderIdx: uniqueIndex("integrations_tenant_provider_idx").on(
      t.tenantId,
      t.provider,
    ),
  }),
);

export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
