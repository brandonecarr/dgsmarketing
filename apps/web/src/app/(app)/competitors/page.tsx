import { db, competitors, competitorSignals } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { CompetitorsView } from "./view";

export default async function CompetitorsPage() {
  const session = await loadActiveSession();
  const list = await db
    .select()
    .from(competitors)
    .where(eq(competitors.tenantId, session.tenant.id))
    .orderBy(desc(competitors.createdAt));

  const signals = await db
    .select()
    .from(competitorSignals)
    .where(eq(competitorSignals.tenantId, session.tenant.id))
    .orderBy(desc(competitorSignals.observedAt))
    .limit(50);

  return (
    <CompetitorsView
      tenantId={session.tenant.id}
      competitors={list.map((c) => ({
        id: c.id,
        name: c.name,
        domain: c.domain,
        gbpUrl: c.gbpUrl,
        metaPageId: c.metaPageId,
        notes: c.notes,
        lastScanAt: c.lastScanAt ? c.lastScanAt.toISOString() : null,
      }))}
      signals={signals.map((s) => ({
        id: s.id,
        competitorId: s.competitorId,
        kind: s.kind,
        summary: s.summary,
        observedAt: s.observedAt.toISOString(),
      }))}
      metaConfigured={Boolean(process.env.META_AD_LIBRARY_TOKEN)}
    />
  );
}
