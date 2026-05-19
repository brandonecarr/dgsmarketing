import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const actionStatusEnum = pgEnum("action_status", [
  "open",
  "in_progress",
  "done",
  "dismissed",
  "snoozed",
]);

export const actionSourceEnum = pgEnum("action_source", [
  "rule_review_after_won",
  "rule_followup_after_quoted",
  "rule_pause_zero_conv",
  "rule_gauge_slipping",
  "rule_no_recent_post",
  "rosie_suggestion",
  "manual",
]);

/**
 * Action Plan items. Surfaced on /action-plan ranked by priority,
 * and emitted by Auto-Rosie rules + Rosie's reasoning.
 */
export const actions = pgTable(
  "actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    source: actionSourceEnum("source").notNull(),
    status: actionStatusEnum("status").notNull().default("open"),

    title: text("title").notNull(),
    /** Markdown body with the "why" and "what to do next". */
    body: text("body"),
    /** 1 (urgent) – 10 (nice to have). Lower is higher priority. */
    priority: integer("priority").notNull().default(5),

    assigneeUserId: uuid("assignee_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    dueAt: timestamp("due_at", { withTimezone: true }),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),

    /** Optional foreign reference to the entity this action is about. */
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: uuid("related_entity_id"),

    /** Free-form metadata: numbers used in the rule, suggested message draft, etc. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index("actions_tenant_status_idx").on(t.tenantId, t.status),
    tenantPriorityIdx: index("actions_tenant_priority_idx").on(t.tenantId, t.priority),
    sourceIdx: index("actions_source_idx").on(t.tenantId, t.source),
  }),
);

export type Action = typeof actions.$inferSelect;
export type NewAction = typeof actions.$inferInsert;
