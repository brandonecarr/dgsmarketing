import { pgTable, uuid, text, jsonb, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const rosieMessageRoleEnum = pgEnum("rosie_message_role", ["user", "assistant", "system"]);

export const rosieThreads = pgTable("rosie_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rosieMessages = pgTable("rosie_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => rosieThreads.id, { onDelete: "cascade" }),
  role: rosieMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  /** Raw assistant message blocks for replaying tool calls later. */
  raw: jsonb("raw"),
  /** Token + cost telemetry from the AI router. */
  usage: jsonb("usage").$type<{
    inputTokens?: number;
    outputTokens?: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
    model?: string;
    costUsd?: number;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  index: integer("index").notNull(),
});

export type RosieThread = typeof rosieThreads.$inferSelect;
export type RosieMessage = typeof rosieMessages.$inferSelect;
export type NewRosieMessage = typeof rosieMessages.$inferInsert;
