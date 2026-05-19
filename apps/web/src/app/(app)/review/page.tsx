import { Card, CardBody, CardHeader } from "@rosie/ui";
import { db, actions } from "@rosie/db";
import { and, asc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { ReviewView } from "./view";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const session = await loadActiveSession();

  const rows = await db
    .select({
      id: actions.id,
      source: actions.source,
      title: actions.title,
      body: actions.body,
      priority: actions.priority,
      metadata: actions.metadata,
      relatedEntityType: actions.relatedEntityType,
      relatedEntityId: actions.relatedEntityId,
      createdAt: actions.createdAt,
    })
    .from(actions)
    .where(and(eq(actions.tenantId, session.tenant.id), eq(actions.status, "open")))
    .orderBy(asc(actions.priority), asc(actions.createdAt))
    .limit(200);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Weekly review</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Open suggestions from Auto-Rosie, the Lead Assistant, and coaching rules. Approve in
            bulk when you trust Rosie's judgment, or step through them one at a time.
          </p>
        </CardHeader>
      </Card>
      <ReviewView
        actions={rows.map((r) => ({
          id: r.id,
          source: r.source,
          title: r.title,
          body: r.body,
          priority: r.priority,
          metadata: r.metadata,
          relatedEntityType: r.relatedEntityType,
          relatedEntityId: r.relatedEntityId,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
