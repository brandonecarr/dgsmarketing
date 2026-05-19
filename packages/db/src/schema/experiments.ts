import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const experimentStatusEnum = pgEnum("experiment_status", [
  "draft",
  "running",
  "paused",
  "concluded",
]);

export const experimentSurfaceEnum = pgEnum("experiment_surface", [
  "cadence",
  "landing_headline",
  "reply_template",
]);

/**
 * A/B (or n-way) experiments Rosie runs on its own outputs. A `surface` says
 * what's being varied; variants live in `experiment_variants`. The picker is
 * Thompson-sampling-style: pulls weighted toward variants with better
 * historical conversion rate but keeps exploring.
 */
export const experiments = pgTable(
  "experiments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Operator-facing label. */
    name: text("name").notNull(),
    surface: experimentSurfaceEnum("surface").notNull(),
    /** Stable identifier the producer uses to look this up — eg "cadence:new_lead". */
    slug: text("slug").notNull(),
    status: experimentStatusEnum("status").notNull().default("draft"),
    /** Optional explicit goal description for the operator. */
    goal: text("goal"),
    /** Total impressions across all variants — handy for reporting. */
    impressions: integer("impressions").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    concludedAt: timestamp("concluded_at", { withTimezone: true }),
  },
  (t) => ({
    tenantSlugIdx: uniqueIndex("experiments_tenant_slug_idx").on(t.tenantId, t.slug),
    statusIdx: index("experiments_status_idx").on(t.tenantId, t.status),
  }),
);

export const experimentVariants = pgTable(
  "experiment_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    /** Variant-specific payload — eg {"headline": "Save 20% this week"}. */
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    impressions: integer("impressions").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    /** Running confidence in this variant, 0–1; updated by the picker. */
    score: numeric("score", { precision: 6, scale: 4 }).notNull().default("0.5000"),
    /** Operator override: when set, picker always serves this variant. */
    isWinner: text("is_winner"),
  },
  (t) => ({
    experimentIdx: index("experiment_variants_experiment_idx").on(t.experimentId),
  }),
);

export type Experiment = typeof experiments.$inferSelect;
export type NewExperiment = typeof experiments.$inferInsert;
export type ExperimentVariant = typeof experimentVariants.$inferSelect;
export type NewExperimentVariant = typeof experimentVariants.$inferInsert;
