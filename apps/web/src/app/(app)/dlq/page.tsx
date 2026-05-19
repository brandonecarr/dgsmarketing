import { Card, CardBody, CardHeader } from "@rosie/ui";
import { loadActiveSession } from "@/lib/active-tenant";
import { listDlqByTenant } from "@/lib/dlq";
import { DlqView } from "./view";

export const dynamic = "force-dynamic";

export default async function DlqPage() {
  const session = await loadActiveSession();
  const rows = await listDlqByTenant(session.tenant.id, 200);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Dead-letter queue</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Background operations that exhausted their in-process retries land here. Pick a row
            to see the error, click Retry to re-run it, or Abandon if the source is broken and
            you're done with it.
          </p>
        </CardHeader>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              Nothing buried. 🎉
            </div>
          ) : (
            <DlqView
              rows={rows.map((r) => ({
                id: r.id,
                source: r.source,
                status: r.status,
                summary: r.summary,
                payload: r.payload,
                lastError: r.lastError,
                attempts: r.attempts,
                replayCount: r.replayCount,
                createdAt: r.createdAt.toISOString(),
              }))}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
