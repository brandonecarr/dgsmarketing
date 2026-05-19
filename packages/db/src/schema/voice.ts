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
import { conversations } from "./conversations";

export const callDirectionEnum = pgEnum("call_direction", ["inbound", "outbound"]);

export const callStatusEnum = pgEnum("call_status", [
  "queued",
  "ringing",
  "in_progress",
  "completed",
  "no_answer",
  "failed",
  "voicemail",
]);

export const callDispositionEnum = pgEnum("call_disposition", [
  "qualified",
  "not_qualified",
  "callback_requested",
  "wrong_number",
  "no_disposition",
]);

/**
 * One row per Vapi (or future Twilio/Retell) call.
 * Voice transcripts append to the linked conversation's `messages` so the
 * inbox renders calls inline alongside SMS.
 */
export const calls = pgTable(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    /** Provider id (Vapi call.id, Twilio CallSid, etc.). */
    externalId: text("external_id"),
    provider: text("provider").notNull().default("vapi"),
    direction: callDirectionEnum("direction").notNull(),
    fromNumber: text("from_number"),
    toNumber: text("to_number"),
    status: callStatusEnum("status").notNull().default("queued"),
    disposition: callDispositionEnum("disposition").notNull().default("no_disposition"),
    /** Full transcript when the provider returns one. */
    transcript: text("transcript"),
    /** AI-generated summary of the call. */
    summary: text("summary"),
    durationSec: numeric("duration_sec", { precision: 8, scale: 2 }),
    recordingUrl: text("recording_url"),
    raw: jsonb("raw"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCreatedIdx: index("calls_tenant_created_idx").on(t.tenantId, t.createdAt),
    externalIdx: index("calls_external_idx").on(t.externalId),
  }),
);

export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
