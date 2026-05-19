import { createHash } from "node:crypto";
import { db, auditLog, type AuditLogRow } from "@rosie/db";

export type AuditAction = AuditLogRow["action"];

interface RecordOpts {
  tenantId: string;
  action: AuditAction;
  actorUserId?: string;
  /** Optional human-readable label when the actor isn't a real user (cron, agent). */
  actorLabel?: "system" | "cron" | "agent";
  entityType?: string;
  entityId?: string;
  summary?: string;
  payload?: Record<string, unknown>;
  /** Pass `req.headers` to capture anonymized IP + UA. */
  headers?: Headers;
}

function ipFrom(headers: Headers | undefined): string | undefined {
  if (!headers) return undefined;
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim();
  return headers.get("x-real-ip") ?? undefined;
}

function hashIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Never blocks the caller — audit failures are logged but swallowed.
 */
export async function recordAudit(opts: RecordOpts): Promise<void> {
  try {
    await db.insert(auditLog).values({
      tenantId: opts.tenantId,
      actorUserId: opts.actorUserId,
      actorLabel: opts.actorLabel,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId,
      summary: opts.summary,
      payload: opts.payload,
      ipHash: hashIp(ipFrom(opts.headers)),
      userAgent: opts.headers?.get("user-agent") ?? undefined,
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
