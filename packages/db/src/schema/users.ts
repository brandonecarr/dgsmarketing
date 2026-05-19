import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Mirrors Supabase `auth.users`. Row inserted by trigger on signup
 * (see migrations/sql/0001_auth_user_mirror.sql).
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
