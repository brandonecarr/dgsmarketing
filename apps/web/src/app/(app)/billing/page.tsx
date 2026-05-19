import { Card, CardBody, CardHeader } from "@rosie/ui";
import { db, subscriptions, usageEvents, sql } from "@rosie/db";
import { and, desc, eq, gte } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { BillingActions } from "./actions";
import { getMonthlySpend } from "@/lib/usage";

export default async function BillingPage() {
  const session = await loadActiveSession();

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, session.tenant.id))
    .limit(1);

  const now = new Date();
  const ms = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const breakdown = await db
    .select({
      kind: usageEvents.kind,
      units: sql<string>`coalesce(sum(${usageEvents.units}), 0)::text`,
      cost: sql<string>`coalesce(sum(${usageEvents.costUsd}), 0)::text`,
    })
    .from(usageEvents)
    .where(and(eq(usageEvents.tenantId, session.tenant.id), gte(usageEvents.createdAt, ms)))
    .groupBy(usageEvents.kind);

  const recent = await db
    .select({
      id: usageEvents.id,
      kind: usageEvents.kind,
      units: usageEvents.units,
      costUsd: usageEvents.costUsd,
      model: usageEvents.model,
      source: usageEvents.source,
      createdAt: usageEvents.createdAt,
    })
    .from(usageEvents)
    .where(eq(usageEvents.tenantId, session.tenant.id))
    .orderBy(desc(usageEvents.createdAt))
    .limit(20);

  const spend = await getMonthlySpend(session.tenant.id);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Billing</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Subscription, usage, and overages.
          </p>
        </CardHeader>
        <CardBody>
          {sub ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SubStat label="Status" value={sub.status} />
              <SubStat label="Plan" value={sub.plan ?? "—"} />
              <SubStat label="Seats" value={String(sub.seats)} />
              <SubStat
                label="Renews"
                value={
                  sub.currentPeriodEnd
                    ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                    : "—"
                }
              />
            </div>
          ) : (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              No active subscription. Start a checkout below to subscribe.
            </div>
          )}
          <BillingActions hasCustomer={Boolean(sub?.stripeCustomerId)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">This month</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <SubStat label="LLM spend" value={`$${spend.llmUsd.toFixed(2)}`} />
            <SubStat label="SMS sent" value={String(spend.smsSent)} />
            <SubStat label="Images" value={String(spend.imagesGenerated)} />
            <SubStat label="Total" value={`$${spend.totalUsd.toFixed(2)}`} />
          </div>
          {breakdown.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-sm">
              {breakdown.map((b) => (
                <li
                  key={b.kind}
                  className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] px-3 py-1.5"
                >
                  <span className="font-mono text-xs">{b.kind}</span>
                  <span>
                    <strong>{Number(b.units).toLocaleString()}</strong> units · $
                    {Number(b.cost).toFixed(4)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">Recent usage</h3>
        </CardHeader>
        <CardBody>
          {recent.length === 0 ? (
            <div className="text-xs text-[hsl(var(--muted-foreground))]">No usage yet.</div>
          ) : (
            <ul className="space-y-1 text-xs">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{r.kind}</span>
                    {r.source ? (
                      <span className="text-[hsl(var(--muted-foreground))]">· {r.source}</span>
                    ) : null}
                    {r.model ? (
                      <span className="text-[hsl(var(--muted-foreground))]">· {r.model}</span>
                    ) : null}
                  </div>
                  <div className="text-[hsl(var(--muted-foreground))]">
                    {Number(r.units).toLocaleString()} units · ${Number(r.costUsd).toFixed(4)} ·{" "}
                    {new Date(r.createdAt).toLocaleTimeString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function SubStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-center">
      <div className="text-base font-semibold uppercase tracking-wider">{value}</div>
      <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{label}</div>
    </div>
  );
}
