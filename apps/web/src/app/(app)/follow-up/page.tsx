import { db, cadences, cadenceRuns } from "@rosie/db";
import { desc, eq, sql } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { FollowUpView } from "./view";

export default async function FollowUpPage() {
  const session = await loadActiveSession();
  const rows = await db
    .select()
    .from(cadences)
    .where(eq(cadences.tenantId, session.tenant.id))
    .orderBy(desc(cadences.createdAt));

  const runStats = await db
    .select({
      cadenceId: cadenceRuns.cadenceId,
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where status in ('scheduled','running'))::int`,
      completed: sql<number>`count(*) filter (where status = 'completed')::int`,
    })
    .from(cadenceRuns)
    .where(eq(cadenceRuns.tenantId, session.tenant.id))
    .groupBy(cadenceRuns.cadenceId);

  const statsById = new Map(runStats.map((s) => [s.cadenceId, s]));

  return (
    <FollowUpView
      cadences={rows.map((c) => ({
        id: c.id,
        name: c.name,
        trigger: c.trigger,
        triggerStage: c.triggerStage,
        enabled: c.enabled,
        stopOnReply: c.stopOnReply,
        stepCount: c.steps?.length ?? 0,
        steps: c.steps ?? [],
        stats: statsById.get(c.id) ?? { total: 0, active: 0, completed: 0 },
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
