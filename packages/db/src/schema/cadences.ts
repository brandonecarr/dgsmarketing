import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  pgEnum,
  integer,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { leads } from "./leads";

export const cadenceTriggerEnum = pgEnum("cadence_trigger", [
  "lead_created",
  "stage_change",
  "manual",
]);

export const cadenceRunStatusEnum = pgEnum("cadence_run_status", [
  "scheduled",
  "running",
  "completed",
  "stopped",
  "failed",
]);

export interface CadenceStep {
  /** Hours to wait after the previous step (or after the trigger for step 0). */
  delayHours: number;
  action: "send_sms" | "create_action";
  /** SMS body or action title. Supports `{{name}}` / `{{firstName}}`. */
  body: string;
  /** When action='create_action', priority 1–10. */
  priority?: number;
}

export const cadences = pgTable(
  "cadences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    trigger: cadenceTriggerEnum("trigger").notNull().default("manual"),
    /** When trigger=stage_change, which destination stage fires it. */
    triggerStage: text("trigger_stage"),
    enabled: boolean("enabled").notNull().default(true),
    steps: jsonb("steps").$type<CadenceStep[]>().notNull(),
    /** Stop the cadence if the lead replies. */
    stopOnReply: boolean("stop_on_reply").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("cadences_tenant_idx").on(t.tenantId),
  }),
);

export const cadenceRuns = pgTable(
  "cadence_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    cadenceId: uuid("cadence_id")
      .notNull()
      .references(() => cadences.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    stepIndex: integer("step_index").notNull().default(0),
    status: cadenceRunStatusEnum("status").notNull().default("scheduled"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastStepRanAt: timestamp("last_step_ran_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantNextRunIdx: index("cadence_runs_tenant_next_idx").on(t.tenantId, t.nextRunAt),
    cadenceLeadIdx: uniqueIndex("cadence_runs_cadence_lead_idx").on(t.cadenceId, t.leadId),
  }),
);

export type Cadence = typeof cadences.$inferSelect;
export type NewCadence = typeof cadences.$inferInsert;
export type CadenceRun = typeof cadenceRuns.$inferSelect;
export type NewCadenceRun = typeof cadenceRuns.$inferInsert;
