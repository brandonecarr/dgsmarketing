import { Card, CardBody, CardHeader, GaugeRing, cn } from "@rosie/ui";
import { loadActiveSession } from "@/lib/active-tenant";
import { computeActivation } from "@/lib/activation";
import { ActivationChecklist } from "@/components/activation-checklist";
import { readGaugeClusterCached } from "@/lib/gauges/cached";
import type { GaugeResult } from "@/lib/gauges/types";
import { db, actions } from "@rosie/db";
import { and, eq, or, sql } from "@rosie/db";

const SIMPLE_PATHS = [
  {
    title: "Create",
    blurb: "Make ads, organic content, blog posts, and creative assets.",
    chips: [
      { label: "Ads", href: "/ads" },
      { label: "Posts", href: "/posts" },
      { label: "Images", href: "/images" },
      { label: "QR", href: "/qr" },
    ],
  },
  {
    title: "Manage Your Business",
    blurb: "Handle connections, KPIs, Google Profile, and settings.",
    chips: [
      { label: "Settings", href: "/settings" },
      { label: "KPIs", href: "/kpis" },
      { label: "My Business", href: "/business" },
    ],
  },
  {
    title: "Analyze",
    blurb: "Read the gauges and understand what's helping or hurting growth.",
    chips: [
      { label: "Overview", href: "/overview" },
      { label: "Action Plan", href: "/action-plan" },
      { label: "KPIs", href: "/kpis" },
    ],
  },
  {
    title: "Outreach & Communications",
    blurb: "Stay on top of leads, conversations, and follow-up.",
    chips: [
      { label: "Inbox", href: "/inbox" },
      { label: "Action Plan", href: "/action-plan" },
    ],
  },
];

const STATUS_COLOR: Record<GaugeResult["status"], string> = {
  healthy: "text-emerald-600",
  watch: "text-amber-600",
  critical: "text-red-600",
  none: "text-[hsl(var(--muted-foreground))]",
};

const STATUS_LABEL: Record<GaugeResult["status"], string> = {
  healthy: "Healthy",
  watch: "Watch",
  critical: "Critical",
  none: "No data",
};

export default async function OverviewPage() {
  const session = await loadActiveSession();
  const { cluster } = await readGaugeClusterCached(session.tenant.id);
  const activation = await computeActivation({
    id: session.tenant.id,
    name: session.tenant.name,
    brandTheme: (session.tenant.brandTheme as Record<string, unknown> | null) ?? null,
  });

  const [openCountRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(actions)
    .where(
      and(
        eq(actions.tenantId, session.tenant.id),
        or(eq(actions.status, "open"), eq(actions.status, "in_progress")),
      ),
    );
  const openActions = openCountRow?.c ?? 0;

  return (
    <div className="space-y-6">
      {!activation.complete ? (
        <ActivationChecklist
          steps={activation.steps}
          done={activation.done}
          total={activation.total}
        />
      ) : null}

      <Card>
        <CardHeader>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-rosie-700">
            Simple Paths
          </div>
          <h2 className="mt-1 text-xl font-bold">What do you want to do today?</h2>
          <p className="mt-1 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
            You don't need to learn the whole platform first. Pick the lane that matches the
            job you're trying to get done, then read the gauge cluster below to see what's
            healthy, what's slipping, and what to fix next.
          </p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {SIMPLE_PATHS.map((p) => (
              <div
                key={p.title}
                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4"
              >
                <div className="font-semibold">{p.title}</div>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{p.blurb}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.chips.map((c) => (
                    <a
                      key={c.href}
                      href={c.href}
                      className="rounded-full border border-[hsl(var(--border))] px-2 py-0.5 text-[10px] hover:bg-[hsl(var(--muted))]"
                    >
                      {c.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              {cluster.pacingHeadline ? (
                <div className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                  Ahead of pace
                </div>
              ) : (
                <div className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  Tracking
                </div>
              )}
              <h2 className="mt-2 text-xl font-bold">Gauge Cluster</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {cluster.pacingHeadline ??
                  "Set a leads-per-month KPI on /kpis to unlock pacing. The four gauges below score from the data you do have."}
              </p>
              {openActions > 0 ? (
                <p className="mt-2 text-xs">
                  <a href="/action-plan" className="font-semibold text-rosie-700 underline">
                    {openActions} action{openActions === 1 ? "" : "s"} waiting on the Action Plan →
                  </a>
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <div
                className={cn(
                  "text-5xl font-extrabold",
                  cluster.composite === null ? "text-[hsl(var(--muted-foreground))]" : "",
                )}
              >
                {cluster.grade ?? "–"}
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                {cluster.composite ? `${cluster.composite} composite` : "Composite score pending"}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {([cluster.paid, cluster.organic, cluster.website, cluster.kpis] as GaugeResult[]).map(
              (g) => (
                <GaugeCard key={g.key} gauge={g} />
              ),
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

const GAUGE_LABEL: Record<GaugeResult["key"], string> = {
  paid: "Paid Ads",
  organic: "Organic",
  website: "Website",
  kpis: "KPIs",
};

const GAUGE_SUB: Record<GaugeResult["key"], string> = {
  paid: "Google and Meta",
  organic: "SEO, content, social",
  website: "Conversion health",
  kpis: "Targets and pacing",
};

function GaugeCard({ gauge }: { gauge: GaugeResult }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold">{GAUGE_LABEL[gauge.key]}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            {GAUGE_SUB[gauge.key]}
          </div>
        </div>
        <GaugeRing
          value={gauge.score ?? 0}
          status={gauge.status}
          label={STATUS_LABEL[gauge.status]}
        />
      </div>
      <div className={cn("text-xs font-semibold", STATUS_COLOR[gauge.status])}>
        {gauge.headline}
      </div>
      <div className="border-t border-[hsl(var(--border))] pt-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          Fix next
        </div>
        <p className="mt-0.5 text-xs">{gauge.fixNext}</p>
      </div>
    </div>
  );
}
