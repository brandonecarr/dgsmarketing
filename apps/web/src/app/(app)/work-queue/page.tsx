import { db, actions } from "@rosie/db";
import { and, desc, eq, isNull, or, sql } from "@rosie/db";
import { Card, CardBody, CardHeader, cn } from "@rosie/ui";
import { loadActiveSession } from "@/lib/active-tenant";

export default async function WorkQueuePage() {
  const session = await loadActiveSession();

  // Mine: assigned to me + unassigned + in-progress.
  const mine = await db
    .select()
    .from(actions)
    .where(
      and(
        eq(actions.tenantId, session.tenant.id),
        or(
          eq(actions.assigneeUserId, session.user.id),
          isNull(actions.assigneeUserId),
        ),
        or(eq(actions.status, "open"), eq(actions.status, "in_progress")),
      ),
    )
    .orderBy(actions.priority, desc(actions.createdAt))
    .limit(60);

  const [counts] = await db
    .select({
      open: sql<number>`count(*) filter (where status = 'open')::int`,
      inProgress: sql<number>`count(*) filter (where status = 'in_progress')::int`,
      doneToday: sql<number>`count(*) filter (where status = 'done' and completed_at >= now() - interval '1 day')::int`,
    })
    .from(actions)
    .where(eq(actions.tenantId, session.tenant.id));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Work Queue</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Your assigned and unclaimed actions. Same data as Action Plan, filtered to
            things you can pick up right now. Click an action to go to its full detail in /action-plan.
          </p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Open" value={counts?.open ?? 0} />
            <Stat label="In progress" value={counts?.inProgress ?? 0} tone="warn" />
            <Stat label="Done today" value={counts?.doneToday ?? 0} tone="ok" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {mine.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              No open work for you. Head to <a href="/action-plan" className="underline">Action Plan</a> to claim something.
            </div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {mine.map((a) => (
                <li key={a.id} className="px-5 py-3 text-sm">
                  <a href="/action-plan" className="flex items-start gap-3 hover:bg-[hsl(var(--muted))] rounded-md p-1 -m-1">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                        a.priority <= 2
                          ? "bg-red-500 text-white"
                          : a.priority <= 4
                            ? "bg-amber-500 text-amber-950"
                            : "bg-rosie-100 text-rosie-700 dark:bg-rosie-900 dark:text-rosie-100",
                      )}
                    >
                      {a.priority}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{a.title}</div>
                      {a.body ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">
                          {a.body}
                        </p>
                      ) : null}
                      <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                        <span>{a.status.replace("_", " ")}</span>
                        <span>·</span>
                        <span>{a.source}</span>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-center">
      <div
        className={cn(
          "text-2xl font-bold",
          tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "",
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
    </div>
  );
}
