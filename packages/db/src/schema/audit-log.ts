import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const auditActionEnum = pgEnum("audit_action", [
  "integration.connect",
  "integration.disconnect",
  "integration.update",
  "api_key.create",
  "api_key.revoke",
  "member.invite",
  "member.accept",
  "member.revoke",
  "member.role_change",
  "billing.checkout",
  "billing.portal",
  "billing.subscription_change",
  "branding.update",
  "spend_budget.update",
  "tenant.update",
  "impersonation.start",
  "impersonation.end",
  "lead.export",
  "data.delete_request",
]);

/**
 * General-purpose human-action audit log. Distinct from `auto_rosie_runs`
 * (agent actions): this captures *operator* changes to tenant config so we
 * can answer "who connected/disconnected/changed what."
 *
 * Helper: see [`apps/web/src/lib/audit.ts`](../../../../apps/web/src/lib/audit.ts).
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** "system" when the action was via cron/agent, otherwise null + actorUserId. */
    actorLabel: text("actor_label"),
    action: auditActionEnum("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    summary: text("summary"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    /** Anonymized client info. */
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCreatedIdx: index("audit_log_tenant_created_idx").on(t.tenantId, t.createdAt),
    tenantActionIdx: index("audit_log_tenant_action_idx").on(t.tenantId, t.action),
  }),
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
