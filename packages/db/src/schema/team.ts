import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";
import { membershipRoleEnum } from "./memberships";

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: membershipRoleEnum("role").notNull().default("operator"),
    /** SHA-256 hex of the invitation token. Plaintext is one-shot in the email. */
    tokenHash: text("token_hash").notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantEmailIdx: index("invitations_tenant_email_idx").on(t.tenantId, t.email),
    tokenIdx: index("invitations_token_idx").on(t.tokenHash),
  }),
);

export const specialists = pgTable(
  "specialists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category"),
    phone: text("phone"),
    email: text("email"),
    notes: text("notes"),
    /** Tags like 'preferred', 'overflow', 'avoid'. */
    tags: jsonb("tags").$type<string[]>(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCategoryIdx: index("specialists_tenant_category_idx").on(t.tenantId, t.category),
  }),
);

export const jobStatusEnum = pgEnum("job_status", ["draft", "open", "paused", "closed"]);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    requirements: text("requirements"),
    compensation: text("compensation"),
    status: jobStatusEnum("status").notNull().default("draft"),
    /** Where the job is being advertised. */
    surfaces: jsonb("surfaces").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index("jobs_tenant_status_idx").on(t.tenantId, t.status),
  }),
);

export const applicantStatusEnum = pgEnum("applicant_status", [
  "new",
  "contacted",
  "interview",
  "offer",
  "hired",
  "rejected",
]);

export const jobApplicants = pgTable(
  "job_applicants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    notes: text("notes"),
    status: applicantStatusEnum("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    jobStatusIdx: index("applicants_job_status_idx").on(t.jobId, t.status),
  }),
);

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type Specialist = typeof specialists.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type JobApplicant = typeof jobApplicants.$inferSelect;
