import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const dlqStatusEnum = pgEnum("dlq_status", [
  "pending",
  "retrying",
  "resolved",
  "abandoned",
]);

/**
 * Dead-letter queue. Any background operation that exhausts its in-process
 * retries should land a row here so an operator can investigate and replay.
 *
 * The `source` is a short opaque identifier ("capi.meta.lead", "google.ads.upload",
 * "cadence.send", etc.) that tells the operator which handler to look at.
 * The `payload` is the *minimum* info needed to replay — never the raw
 * webhook body (which may contain secrets or be huge). Replay handlers
 * dispatch on `source`.
 */
export const deadLetterQueue = pgTable(
  "dead_letter_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    status: dlqStatusEnum("status").notNull().default("pending"),
    /** Free-form one-liner the operator sees first. */
    summary: text("summary"),
    /** Minimal serializable input the replay handler needs. */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    /** Last error message + stack snippet. */
    lastError: text("last_error"),
    /** How many in-process retries already happened before landing here. */
    attempts: integer("attempts").notNull().default(0),
    /** Bump every time the operator hits "Retry" from the UI. */
    replayCount: integer("replay_count").notNull().default(0),
    lastReplayAt: timestamp("last_replay_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("dlq_status_idx").on(t.status, t.createdAt),
    sourceIdx: index("dlq_source_idx").on(t.source, t.createdAt),
  }),
);

export type DlqEntry = typeof deadLetterQueue.$inferSelect;
export type NewDlqEntry = typeof deadLetterQueue.$inferInsert;
