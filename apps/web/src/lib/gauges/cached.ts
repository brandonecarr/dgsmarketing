import { db, metricsSnapshots } from "@rosie/db";
import { and, desc, eq, gte } from "@rosie/db";
import { computeGaugeCluster } from "./compute";
import type { GaugeCluster, GaugeResult } from "./types";

/**
 * Reads the most recent gauge snapshot from `metrics_snapshots`. If none today,
 * falls back to live computation AND writes a fresh snapshot so the next caller
 * gets the cached path. Result is materialized + ~10ms instead of 8 queries.
 */
export async function readGaugeClusterCached(
  tenantId: string,
  opts: { maxAgeMinutes?: number; forceRefresh?: boolean } = {},
): Promise<{ cluster: GaugeCluster; source: "snapshot" | "fresh"; snapshotDate: string | null }> {
  if (opts.forceRefresh) {
    return { cluster: await refresh(tenantId), source: "fresh", snapshotDate: today() };
  }

  const maxAgeMs = (opts.maxAgeMinutes ?? 60 * 24) * 60_000;
  const cutoff = new Date(Date.now() - maxAgeMs);

  const [snap] = await db
    .select()
    .from(metricsSnapshots)
    .where(
      and(eq(metricsSnapshots.tenantId, tenantId), gte(metricsSnapshots.createdAt, cutoff)),
    )
    .orderBy(desc(metricsSnapshots.createdAt))
    .limit(1);

  if (snap && snap.breakdown) {
    const breakdown = snap.breakdown as {
      paid: GaugeResult;
      organic: GaugeResult;
      website: GaugeResult;
      kpis: GaugeResult;
    };
    return {
      cluster: {
        paid: breakdown.paid,
        organic: breakdown.organic,
        website: breakdown.website,
        kpis: breakdown.kpis,
        composite: snap.compositeScore,
        grade: snap.compositeGrade,
        pacingHeadline: snap.pacingHeadline,
      },
      source: "snapshot",
      snapshotDate: snap.snapshotDate,
    };
  }

  return { cluster: await refresh(tenantId), source: "fresh", snapshotDate: today() };
}

function today(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

async function refresh(tenantId: string): Promise<GaugeCluster> {
  const cluster = await computeGaugeCluster(tenantId);
  // Persist for next time. Upsert on (tenant, today).
  try {
    await db
      .insert(metricsSnapshots)
      .values({
        tenantId,
        snapshotDate: today(),
        paidScore: cluster.paid.score,
        paidStatus: cluster.paid.status,
        organicScore: cluster.organic.score,
        organicStatus: cluster.organic.status,
        websiteScore: cluster.website.score,
        websiteStatus: cluster.website.status,
        kpisScore: cluster.kpis.score,
        kpisStatus: cluster.kpis.status,
        compositeScore: cluster.composite,
        compositeGrade: cluster.grade,
        pacingHeadline: cluster.pacingHeadline,
        breakdown: {
          paid: cluster.paid,
          organic: cluster.organic,
          website: cluster.website,
          kpis: cluster.kpis,
        },
      })
      .onConflictDoUpdate({
        target: [metricsSnapshots.tenantId, metricsSnapshots.snapshotDate],
        set: {
          paidScore: cluster.paid.score,
          paidStatus: cluster.paid.status,
          organicScore: cluster.organic.score,
          organicStatus: cluster.organic.status,
          websiteScore: cluster.website.score,
          websiteStatus: cluster.website.status,
          kpisScore: cluster.kpis.score,
          kpisStatus: cluster.kpis.status,
          compositeScore: cluster.composite,
          compositeGrade: cluster.grade,
          pacingHeadline: cluster.pacingHeadline,
          breakdown: {
            paid: cluster.paid,
            organic: cluster.organic,
            website: cluster.website,
            kpis: cluster.kpis,
          },
        },
      });
  } catch (e) {
    console.error("snapshot upsert failed", e);
  }
  return cluster;
}
