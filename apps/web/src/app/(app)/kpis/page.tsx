import { db, kpis } from "@rosie/db";
import { eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { readGaugeClusterCached } from "@/lib/gauges/cached";
import { KpisView } from "./view";

export default async function KpisPage() {
  const session = await loadActiveSession();
  const rows = await db
    .select()
    .from(kpis)
    .where(eq(kpis.tenantId, session.tenant.id));
  const { cluster } = await readGaugeClusterCached(session.tenant.id);

  return (
    <KpisView
      kpis={rows.map((k) => ({
        id: k.id,
        name: k.name,
        type: k.type,
        period: k.period,
        targetValue: Number(k.targetValue),
        direction: k.direction,
        unit: k.unit,
      }))}
      cluster={cluster}
    />
  );
}
