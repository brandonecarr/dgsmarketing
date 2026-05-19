import { db, auditLog, users } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { Card, CardBody, CardHeader } from "@rosie/ui";
import { loadActiveSession } from "@/lib/active-tenant";
import { AuditView } from "./view";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const session = await loadActiveSession();
  const sp = await searchParams;

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      summary: auditLog.summary,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      payload: auditLog.payload,
      actorLabel: auditLog.actorLabel,
      actorUserEmail: users.email,
      actorUserName: users.fullName,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(eq(auditLog.tenantId, session.tenant.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(200);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Audit log</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Who changed what on this tenant. Distinct from /action-plan's Auto-Rosie audit
            (which logs <em>agent</em> actions). This one tracks <em>operator</em> changes —
            integrations, API keys, invites, billing.
          </p>
        </CardHeader>
      </Card>

      <AuditView
        rows={rows.map((r) => ({
          id: r.id,
          action: r.action,
          summary: r.summary,
          entityType: r.entityType,
          entityId: r.entityId,
          payload: r.payload,
          actor: r.actorUserName ?? r.actorUserEmail ?? r.actorLabel ?? "—",
          createdAt: r.createdAt.toISOString(),
        }))}
        activeFilter={sp.action ?? null}
      />
    </div>
  );
}
