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
import { leads } from "./leads";
import { users } from "./users";

export const bulkMessageStatusEnum = pgEnum("bulk_message_status", [
  "draft",
  "scheduled",
  "sending",
  "completed",
  "failed",
  "cancelled",
]);

export const bulkRecipientStatusEnum = pgEnum("bulk_recipient_status", [
  "pending",
  "sent",
  "failed",
  "skipped",
]);

export interface BulkFilter {
  stages?: string[];
  source?: string[];
  /** Lead created within the last N days. */
  createdWithinDays?: number;
  /** No outbound in the last N days. */
  noOutboundForDays?: number;
  /** Only commercial / only residential, default both. */
  commercial?: "only" | "exclude" | "any";
}

export const bulkMessages = pgTable(
  "bulk_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    body: text("body").notNull(),
    filter: jsonb("filter").$type<BulkFilter>(),
    status: bulkMessageStatusEnum("status").notNull().default("draft"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
    /** Snapshot of recipient count at materialization. */
    recipientCount: text("recipient_count"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index("bulk_msg_tenant_status_idx").on(t.tenantId, t.status),
  }),
);

export const bulkMessageRecipients = pgTable(
  "bulk_message_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    bulkMessageId: uuid("bulk_message_id")
      .notNull()
      .references(() => bulkMessages.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    phone: text("phone").notNull(),
    status: bulkRecipientStatusEnum("status").notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
    /** External provider message id. */
    externalId: text("external_id"),
  },
  (t) => ({
    bulkStatusIdx: index("bulk_recip_bulk_status_idx").on(t.bulkMessageId, t.status),
  }),
);

export type BulkMessage = typeof bulkMessages.$inferSelect;
export type NewBulkMessage = typeof bulkMessages.$inferInsert;
export type BulkMessageRecipient = typeof bulkMessageRecipients.$inferSelect;
