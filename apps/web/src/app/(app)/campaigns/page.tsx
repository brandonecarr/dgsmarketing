import { db, adCampaigns, adMetricsDaily } from "@rosie/db";
import { and, desc, eq, gte, sql } from "@rosie/db";
import { Card, CardBody, CardHeader, cn } from "@rosie/ui";
import { loadActiveSession } from "@/lib/active-tenant";

export default async function CampaignsPage() {
  const session = await loadActiveSession();

  const campaigns = await db
    .select()
    .from(adCampaigns)
    .where(eq(adCampaigns.tenantId, session.tenant.id))
    .orderBy(desc(adCampaigns.updatedAt))
    .limit(100);

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const metrics = await db
    .select({
      campaignId: adMetricsDaily.campaignId,
      spend: sql<string>`coalesce(sum(${adMetricsDaily.spendUsd}), 0)::text`,
      impressions: sql<number>`coalesce(sum(${adMetricsDaily.impressions}), 0)::int`,
      clicks: sql<number>`coalesce(sum(${adMetricsDaily.clicks}), 0)::int`,
      conversions: sql<number>`coalesce(sum(${adMetricsDaily.conversions}), 0)::int`,
    })
    .from(adMetricsDaily)
    .where(and(eq(adMetricsDaily.tenantId, session.tenant.id), gte(adMetricsDaily.date, since)))
    .groupBy(adMetricsDaily.campaignId);
  const byId = new Map(metrics.map((m) => [m.campaignId, m]));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Campaigns</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Every ad campaign synced from Meta / Google Ads / TikTok with 30-day spend, clicks,
            and conversions. Connect platforms in <a href="/settings#ads" className="underline">Settings → Ad platforms</a>{" "}
            to populate this view.
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardBody className="p-0">
          {campaigns.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              No campaigns synced yet. Connect a platform and hit "Sync now".
            </div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {campaigns.map((c) => {
                const m = byId.get(c.id);
                const spend = m ? Number(m.spend) : 0;
                const cpl = m && m.conversions > 0 ? spend / m.conversions : null;
                return (
                  <li key={c.id} className="grid grid-cols-1 items-center gap-3 px-5 py-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{c.name ?? c.externalId}</span>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            c.status === "active"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
                              : c.status === "paused"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100"
                                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
                          )}
                        >
                          {c.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        {c.platform} · {c.externalId}
                      </div>
                    </div>
                    <Stat label="Spend (30d)" value={`$${spend.toFixed(0)}`} />
                    <Stat label="Clicks" value={String(m?.clicks ?? 0)} />
                    <Stat label="Conv." value={String(m?.conversions ?? 0)} />
                    <Stat label="CPL" value={cpl !== null ? `$${cpl.toFixed(2)}` : "—"} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
    </div>
  );
}
