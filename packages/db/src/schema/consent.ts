import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { leads } from "./leads";

export const consentMethodEnum = pgEnum("consent_method", [
  "web_form",
  "lead_webhook",
  "sms_double_optin",
  "voice",
  "manual",
  "import",
]);

export const consentScopeEnum = pgEnum("consent_scope", ["sms_marketing", "email_marketing", "all"]);

/**
 * TCPA-required consent capture. One row per (lead, scope, captured_at) so the
 * audit trail is append-only. The `disclosure` text MUST be the verbatim string
 * shown to the user at capture time so we can defend the record later.
 */
export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    phone: text("phone"),
    email: text("email"),
    method: consentMethodEnum("method").notNull(),
    scope: consentScopeEnum("scope").notNull().default("sms_marketing"),
    /** Verbatim disclosure text shown to the user at capture time. */
    disclosure: text("disclosure").notNull(),
    /** Verbatim text the user provided (e.g. an SMS reply "YES"). */
    userResponse: text("user_response"),
    /** Where the consent was captured: landing page slug, FB form id, etc. */
    source: text("source"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantPhoneIdx: index("consent_records_tenant_phone_idx").on(t.tenantId, t.phone),
    tenantLeadIdx: index("consent_records_tenant_lead_idx").on(t.tenantId, t.leadId),
  }),
);

export const optOutSourceEnum = pgEnum("opt_out_source", [
  "sms_keyword",
  "operator_manual",
  "dsar_request",
  "bounce",
  "complaint",
]);

/**
 * SMS opt-outs. Required by TCPA: once a number replies STOP we must never
 * SMS it again from this tenant. Unique on (tenant, phone) so re-receiving
 * STOP is idempotent.
 */
export const smsOptOuts = pgTable(
  "sms_opt_outs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    source: optOutSourceEnum("source").notNull(),
    /** The exact keyword the user sent, when applicable. */
    keyword: text("keyword"),
    notes: text("notes"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantPhoneIdx: uniqueIndex("sms_opt_outs_tenant_phone_idx").on(t.tenantId, t.phone),
  }),
);

/**
 * GDPR Article 17/20 requests. The DSAR endpoint inserts a row; an operator
 * processes it manually (or we auto-process for `delete` when the email/phone
 * matches a single lead unambiguously).
 */
export const dsarRequestStatusEnum = pgEnum("dsar_request_status", [
  "received",
  "verified",
  "completed",
  "denied",
]);

export const dsarRequestKindEnum = pgEnum("dsar_request_kind", ["export", "delete"]);

export const dsarRequests = pgTable(
  "dsar_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    kind: dsarRequestKindEnum("kind").notNull(),
    status: dsarRequestStatusEnum("status").notNull().default("received"),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    /** SHA-256 hex of a short token mailed to the requester for verification. */
    verifyTokenHash: text("verify_token_hash"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByUserId: uuid("completed_by_user_id"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index("dsar_tenant_status_idx").on(t.tenantId, t.status),
  }),
);

export type ConsentRecord = typeof consentRecords.$inferSelect;
export type NewConsentRecord = typeof consentRecords.$inferInsert;
export type SmsOptOut = typeof smsOptOuts.$inferSelect;
export type DsarRequest = typeof dsarRequests.$inferSelect;
