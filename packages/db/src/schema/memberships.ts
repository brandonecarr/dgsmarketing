import { pgTable, uuid, timestamp, pgEnum, primaryKey } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "operator",
  "staff",
  "client",
]);

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull().default("operator"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.tenantId] }),
  }),
);

export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
