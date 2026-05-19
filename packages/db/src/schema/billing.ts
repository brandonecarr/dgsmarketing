import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  pgEnum,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    plan: text("plan"),
    status: subscriptionStatusEnum("status").notNull().default("incomplete"),
    seats: integer("seats").notNull().default(1),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAt: timestamp("cancel_at", { withTimezone: true }),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: uniqueIndex("subs_tenant_idx").on(t.tenantId),
    stripeCustomerIdx: uniqueIndex("subs_stripe_customer_idx").on(t.stripeCustomerId),
    stripeSubIdx: uniqueIndex("subs_stripe_subscription_idx").on(t.stripeSubscriptionId),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
