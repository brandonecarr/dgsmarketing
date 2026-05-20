import { NextResponse } from "next/server";
import { z } from "zod";
import { db, customers } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { clusterCustomers, type CustomerPoint } from "@/lib/route-plan";

export const runtime = "nodejs";
export const maxDuration = 60;

const SERVICE_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type ServiceDay = (typeof SERVICE_DAYS)[number];

const Body = z.object({
  workingDays: z.array(z.enum(SERVICE_DAYS)).min(1).max(7),
  /** Stops/day ceiling as a multiplier of avg. 1.3 = +30% over balanced. */
  maxImbalance: z.number().min(1).max(3).optional(),
  /** Deterministic re-runs. */
  seed: z.number().int().optional(),
});

/**
 * Re-assign every active customer to one of the operator's working days
 * based on geographic clustering. Returns a *proposal* — nothing is written
 * to the customers table here. Apply via /api/customers/batch-update.
 *
 * One customer → one day, even if they were previously scheduled multi-day.
 * Multi-day customers can be re-added manually after applying.
 */
export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      address: customers.address,
      serviceDays: customers.serviceDays,
      zone: customers.zone,
    })
    .from(customers)
    .where(and(eq(customers.tenantId, session.tenant.id), eq(customers.status, "active")));

  // Split into mappable (have lat/lng) and unmappable.
  const points: Array<CustomerPoint & { fromDays: ServiceDay[]; zone: string | null }> = [];
  const unmappable: Array<{ id: string; name: string; reason: string }> = [];
  for (const r of rows) {
    const addr = (r.address ?? {}) as { lat?: number; lng?: number };
    if (typeof addr.lat !== "number" || typeof addr.lng !== "number") {
      unmappable.push({ id: r.id, name: r.name, reason: "missing geocode" });
      continue;
    }
    points.push({
      id: r.id,
      name: r.name,
      lat: addr.lat,
      lng: addr.lng,
      fromDays: (r.serviceDays ?? []) as ServiceDay[],
      zone: r.zone,
    });
  }

  if (points.length === 0) {
    return NextResponse.json({
      ok: true,
      proposals: [],
      perDay: parsed.data.workingDays.map((d) => ({
        day: d,
        count: 0,
        centroidLat: 0,
        centroidLng: 0,
        spreadKm: 0,
      })),
      unmappable,
      summary: {
        totalCustomers: rows.length,
        mappable: 0,
        unmappable: unmappable.length,
        iterations: 0,
        converged: true,
      },
    });
  }

  const result = clusterCustomers(points, {
    k: parsed.data.workingDays.length,
    maxImbalance: parsed.data.maxImbalance,
    seed: parsed.data.seed,
  });

  // Order clusters by centroid longitude (west → east) before mapping to days.
  // This way the operator's Mon route tends to be the west side, Fri the east —
  // doesn't matter for routing, but visually consistent across re-runs.
  const orderedClusters = [...result.clusters]
    .map((c, originalIdx) => ({ ...c, originalIdx }))
    .sort((a, b) => a.centroidLng - b.centroidLng);

  const proposals: Array<{
    customerId: string;
    name: string;
    fromDays: ServiceDay[];
    toDay: ServiceDay;
    lat: number;
    lng: number;
  }> = [];
  const perDay: Array<{
    day: ServiceDay;
    count: number;
    centroidLat: number;
    centroidLng: number;
    spreadKm: number;
  }> = [];

  parsed.data.workingDays.forEach((day, dayIdx) => {
    const cluster = orderedClusters[dayIdx];
    if (!cluster) {
      perDay.push({ day, count: 0, centroidLat: 0, centroidLng: 0, spreadKm: 0 });
      return;
    }
    for (const c of cluster.customers) {
      const original = points.find((p) => p.id === c.id)!;
      proposals.push({
        customerId: c.id,
        name: c.name,
        fromDays: original.fromDays,
        toDay: day,
        lat: c.lat,
        lng: c.lng,
      });
    }
    perDay.push({
      day,
      count: cluster.customers.length,
      centroidLat: cluster.centroidLat,
      centroidLng: cluster.centroidLng,
      spreadKm: Math.round(cluster.spreadKm * 10) / 10,
    });
  });

  return NextResponse.json({
    ok: true,
    proposals,
    perDay,
    unmappable,
    summary: {
      totalCustomers: rows.length,
      mappable: points.length,
      unmappable: unmappable.length,
      iterations: result.iterations,
      converged: result.converged,
    },
  });
}
