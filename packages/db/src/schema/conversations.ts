import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  pgEnum,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { leads } from "./leads";
import { users } from "./users";

export const channelEnum = pgEnum("conversation_channel", [
  "sms",
  "email",
  "call",
  "fb_dm",
  "ig_dm",
]);

export const providerEnum = pgEnum("messaging_provider", [
  "quo",
  "openphone",
  "twilio",
  "fb_messenger",
  "manual",
]);

export const directionEnum = pgEnum("message_direction", ["inbound", "outbound"]);

export const senderTypeEnum = pgEnum("message_sender_type", [
  "lead",
  "operator",
  "rosie",
  "system",
]);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),

    channel: channelEnum("channel").notNull().default("sms"),
    provider: providerEnum("provider").notNull(),
    /** Provider's identifier for the conversation/thread. */
    externalId: text("external_id"),

    participantPhone: text("participant_phone"),
    participantEmail: text("participant_email"),
    participantName: text("participant_name"),

    unreadCount: integer("unread_count").notNull().default(0),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastMessagePreview: text("last_message_preview"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantLastIdx: index("conv_tenant_last_message_idx").on(
      t.tenantId,
      t.lastMessageAt,
    ),
    tenantPhoneIdx: index("conv_tenant_phone_idx").on(t.tenantId, t.participantPhone),
    providerExternalIdx: uniqueIndex("conv_provider_external_idx").on(
      t.provider,
      t.externalId,
    ),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Denormalized so RLS can filter without joining. */
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),

    direction: directionEnum("direction").notNull(),
    senderType: senderTypeEnum("sender_type").notNull(),
    senderUserId: uuid("sender_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    body: text("body").notNull(),
    /** Provider's unique message id (for idempotency on inbound webhooks). */
    externalId: text("external_id"),
    providerMetadata: jsonb("provider_metadata").$type<Record<string, unknown>>(),
    /** Detected BCP-47 language code (eg "en", "es", "pt-BR"). */
    language: text("language"),
    /** Cached translation into the tenant's locale (filled on demand). */
    translatedBody: text("translated_body"),
    /** Locale the translation is *into* — guards cache invalidation. */
    translatedTo: text("translated_to"),

    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    convCreatedIdx: index("msg_conv_created_idx").on(t.conversationId, t.createdAt),
    tenantCreatedIdx: index("msg_tenant_created_idx").on(t.tenantId, t.createdAt),
    externalIdx: uniqueIndex("msg_external_idx").on(t.externalId),
  }),
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
