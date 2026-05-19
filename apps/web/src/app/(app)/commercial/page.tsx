import { db, leads } from "@rosie/db";
import { and, desc, eq, sql } from "@rosie/db";
import { Card, CardBody, CardHeader, cn } from "@rosie/ui";
import { loadActiveSession } from "@/lib/active-tenant";
import { CommercialActions } from "./actions";

export default async function CommercialPage() {
  const session = await loadActiveSession();

  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.tenantId, session.tenant.id), eq(leads.isCommercial, 1)))
    .orderBy(desc(leads.createdAt))
    .limit(100);

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where stage not in ('won','lost'))::int`,
      won: sql<number>`count(*) filter (where stage = 'won')::int`,
    })
    .from(leads)
    .where(and(eq(leads.tenantId, session.tenant.id), eq(leads.isCommercial, 1)));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Commercial Leads</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Separate pipeline view for commercial accounts. Mark any lead commercial from the lead
            row below — the rest of Rosie keeps using the residential pipeline for unmarked leads.
          </p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Stat label="Total" value={stats?.total ?? 0} />
            <Stat label="Active" value={stats?.active ?? 0} />
            <Stat label="Won" value={stats?.won ?? 0} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">All commercial leads</h3>
        </CardHeader>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              No commercial leads yet. Mark a lead commercial from the inbox row actions.
            </div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {rows.map((l) => (
                <li key={l.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">
                        {l.name ?? l.phone ?? l.email ?? "Unknown lead"}
                      </div>
                      <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        {l.phone} · {l.email}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        l.stage === "won"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
                          : l.stage === "lost"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-100",
                      )}
                    >
                      {l.stage}
                    </div>
                    <CommercialActions leadId={l.id} />
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
    </div>
  );
}
