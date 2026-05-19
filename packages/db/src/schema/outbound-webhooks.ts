import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/**
 * Event types Rosie emits to subscribed external endpoints. Add a value here
 * when a new producer in the codebase calls `emitEvent()`. The set of
 * subscribable events is *the* contract operators integrate against.
 */
export const outboundEventEnum = pgEnum("outbound_event", [
  "lead.created",
  "lead.stage_changed",
  "lead.won",
  "conversation.message_received",
  "conversation.message_sent",
  "call.completed",
  "review.received",
]);

export type OutboundEvent =
  | "lead.created"
  | "lead.stage_changed"
  | "lead.won"
  | "conversation.message_received"
  | "conversation.message_sent"
  | "call.completed"
  | "review.received";

/**
 * Per-tenant subscription. Operators or partner integrations create rows here
 * via the public API or the settings UI. `secret` is the HMAC signing key —
 * Rosie shows it once and stores only the value (no hashing — it has to be
 * the same string we sign with on every dispatch).
 */
export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Human label for the operator. */
    name: text("name").notNull(),
    url: text("url").notNull(),
    /** Signing secret embedded in every outbound request's HMAC. */
    secret: text("secret").notNull(),
    /** Array of OutboundEvent strings; empty array = all events. */
    events: jsonb("events").$type<OutboundEvent[]>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    /** Set to non-null when delivery has failed too many times in a row. */
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspendedReason: text("suspended_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("webhook_subs_tenant_idx").on(t.tenantId),
  }),
);

export const deliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "pending",
  "delivered",
  "failed",
]);

/**
 * One row per attempted delivery. Lets operators inspect what Rosie sent,
 * what the destination replied, and (if needed) replay via the DLQ.
 */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => webhookSubscriptions.id, { onDelete: "cascade" }),
    event: outboundEventEnum("event").notNull(),
    status: deliveryStatusEnum("status").notNull().default("pending"),
    /** What we shipped (after redaction). */
    requestBody: jsonb("request_body").$type<Record<string, unknown>>(),
    /** Status code returned by the destination, when one came back. */
    responseStatus: integer("response_status"),
    /** First 500 chars of the response body for debugging. */
    responseBody: text("response_body"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    /** Latency of the final attempt in ms. */
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    subscriptionIdx: index("webhook_deliveries_subscription_idx").on(t.subscriptionId, t.createdAt),
    eventIdx: index("webhook_deliveries_event_idx").on(t.event, t.createdAt),
  }),
);

export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
