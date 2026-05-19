import { db, actions, autoRosieRuns } from "@rosie/db";
import { desc, eq, sql } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { ActionPlanView } from "./view";

export default async function ActionPlanPage() {
  const session = await loadActiveSession();

  const open = await db
    .select()
    .from(actions)
    .where(eq(actions.tenantId, session.tenant.id))
    .orderBy(sql`case ${actions.status}
      when 'in_progress' then 0
      when 'open' then 1
      when 'snoozed' then 2
      when 'done' then 3
      when 'dismissed' then 4
    end, ${actions.priority} asc, ${actions.createdAt} desc`)
    .limit(80);

  const runs = await db
    .select()
    .from(autoRosieRuns)
    .where(eq(autoRosieRuns.tenantId, session.tenant.id))
    .orderBy(desc(autoRosieRuns.createdAt))
    .limit(20);

  return (
    <ActionPlanView
      tenantId={session.tenant.id}
      actions={open.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        status: a.status,
        source: a.source,
        priority: a.priority,
        metadata: a.metadata,
        relatedEntityType: a.relatedEntityType,
        relatedEntityId: a.relatedEntityId,
        createdAt: a.createdAt.toISOString(),
        completedAt: a.completedAt ? a.completedAt.toISOString() : null,
      }))}
      runs={runs.map((r) => ({
        id: r.id,
        ruleName: r.ruleName,
        status: r.status,
        durationMs: r.durationMs ? Number(r.durationMs) : null,
        createdAt: r.createdAt.toISOString(),
        undoToken: r.undoToken,
      }))}
    />
  );
}
