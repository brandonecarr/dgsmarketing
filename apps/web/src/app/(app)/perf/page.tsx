import { Card, CardBody, CardHeader } from "@rosie/ui";
import { db, slowQueries, webVitals } from "@rosie/db";
import { desc, gte, sql } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

export const dynamic = "force-dynamic";

interface VitalsSummary {
  metric: string;
  p50: number;
  p75: number;
  p95: number;
  sample: number;
}

const VITAL_BUDGETS: Record<string, { good: number; needsImprovement: number; unit: string }> = {
  LCP: { good: 2500, needsImprovement: 4000, unit: "ms" },
  INP: { good: 200, needsImprovement: 500, unit: "ms" },
  FCP: { good: 1800, needsImprovement: 3000, unit: "ms" },
  TTFB: { good: 800, needsImprovement: 1800, unit: "ms" },
  // CLS is stored ×1000 (so 0.1 → 100).
  CLS: { good: 100, needsImprovement: 250, unit: "×1000" },
};

function ratingClass(metric: string, p75: number): string {
  const b = VITAL_BUDGETS[metric];
  if (!b) return "text-[hsl(var(--foreground))]";
  if (p75 <= b.good) return "text-emerald-600 font-semibold";
  if (p75 <= b.needsImprovement) return "text-amber-600 font-semibold";
  return "text-red-600 font-semibold";
}

export default async function PerfPage() {
  await loadActiveSession();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [slow, vitals] = await Promise.all([
    db
      .select()
      .from(slowQueries)
      .where(gte(slowQueries.createdAt, since))
      .orderBy(desc(slowQueries.durationMs))
      .limit(50),
    db.execute(sql<VitalsSummary>`
      select
        metric,
        percentile_cont(0.5) within group (order by value)::int as p50,
        percentile_cont(0.75) within group (order by value)::int as p75,
        percentile_cont(0.95) within group (order by value)::int as p95,
        count(*)::int as sample
      from web_vitals
      where created_at >= ${since}
      group by metric
      order by metric
    `),
  ]);

  const vitalRows = (vitals as unknown as { rows: VitalsSummary[] }).rows ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Performance</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Last 24h. Real-user Web Vitals from the browser plus slow server-side queries logged
            from instrumented routes. Drives optimization decisions; never blocks user requests.
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">Core Web Vitals (real-user)</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            p75 is the threshold Google's Search ranking uses. Green = within budget, amber =
            needs improvement, red = poor.
          </p>
        </CardHeader>
        <CardBody className="p-0">
          {vitalRows.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
              No client metrics in the last 24h. Browse the app for a few minutes — every page
              load posts to /api/perf/vitals.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(var(--muted))] text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="px-5 py-2 text-left">Metric</th>
                    <th className="px-5 py-2 text-right">p50</th>
                    <th className="px-5 py-2 text-right">p75</th>
                    <th className="px-5 py-2 text-right">p95</th>
                    <th className="px-5 py-2 text-right">Sample</th>
                    <th className="px-5 py-2 text-right">Budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {vitalRows.map((r) => (
                    <tr key={r.metric}>
                      <td className="px-5 py-2 font-mono text-xs">{r.metric}</td>
                      <td className="px-5 py-2 text-right">{r.p50.toLocaleString()}</td>
                      <td className={`px-5 py-2 text-right ${ratingClass(r.metric, r.p75)}`}>
                        {r.p75.toLocaleString()}
                      </td>
                      <td className="px-5 py-2 text-right">{r.p95.toLocaleString()}</td>
                      <td className="px-5 py-2 text-right text-[hsl(var(--muted-foreground))]">
                        {r.sample.toLocaleString()}
                      </td>
                      <td className="px-5 py-2 text-right text-[10px] text-[hsl(var(--muted-foreground))]">
                        {(() => {
                          const b = VITAL_BUDGETS[r.metric];
                          return b ? `≤${b.good} ${b.unit}` : "—";
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">
            Slow queries (≥{process.env.SLOW_QUERY_MS ?? 250} ms)
          </h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Logged by the `timed()` wrapper around instrumented DB calls. Sorted by duration desc.
          </p>
        </CardHeader>
        <CardBody className="p-0">
          {slow.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
              No slow queries in the last 24h. 🎉
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(var(--muted))] text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="px-5 py-2 text-left">Label</th>
                    <th className="px-5 py-2 text-left">Path</th>
                    <th className="px-5 py-2 text-right">Duration</th>
                    <th className="px-5 py-2 text-right">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {slow.map((q) => (
                    <tr key={q.id}>
                      <td className="px-5 py-2 font-mono text-xs">{q.label}</td>
                      <td className="px-5 py-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                        {q.path ?? "—"}
                      </td>
                      <td className="px-5 py-2 text-right font-semibold text-red-600">
                        {q.durationMs.toLocaleString()} ms
                      </td>
                      <td className="px-5 py-2 text-right text-[10px] text-[hsl(var(--muted-foreground))]">
                        {new Date(q.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
