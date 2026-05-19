import { NextResponse } from "next/server";
import { z } from "zod";
import { db, customers } from "@rosie/db";
import { and, eq, sql } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { optimizeRoute, type Waypoint } from "@/lib/route-optimize";

export const runtime = "nodejs";

const SERVICE_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const Body = z.object({
  day: z.enum(SERVICE_DAYS),
  /** Optional explicit start point. Defaults to the first stop. */
  start: z.object({ lng: z.number(), lat: z.number() }).optional(),
  /** Return to the start at the end of the route. */
  roundtrip: z.boolean().optional(),
  /** Filter further by zone. Useful for split-day depot routing. */
  zone: z.string().optional(),
});

/**
 * Pulls every active customer whose `serviceDays` includes the requested day,
 * filters out those without geocoded coordinates, runs the optimizer, and
 * returns the order + geometry the map can render.
 */
export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const where = parsed.data.zone
    ? and(
        eq(customers.tenantId, session.tenant.id),
        eq(customers.status, "active"),
        eq(customers.zone, parsed.data.zone),
        sql`${customers.serviceDays} @> ${JSON.stringify([parsed.data.day])}::jsonb`,
      )
    : and(
        eq(customers.tenantId, session.tenant.id),
        eq(customers.status, "active"),
        sql`${customers.serviceDays} @> ${JSON.stringify([parsed.data.day])}::jsonb`,
      );

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      address: customers.address,
    })
    .from(customers)
    .where(where);

  const eligible = rows
    .map((r) => {
      const addr = (r.address ?? {}) as { lat?: number; lng?: number };
      if (typeof addr.lat !== "number" || typeof addr.lng !== "number") return null;
      return { id: r.id, name: r.name, lat: addr.lat, lng: addr.lng } as Waypoint & {
        name: string;
      };
    })
    .filter((x): x is Waypoint & { name: string } => x !== null);

  if (eligible.length === 0) {
    return NextResponse.json({
      ok: true,
      day: parsed.data.day,
      stops: [],
      totalSkipped: rows.length,
      reason:
        rows.length > 0
          ? "All matching customers are missing geocoded coordinates. Re-save their address with a Mapbox token configured."
          : "No active customers scheduled for that day.",
    });
  }

  // Prepend the explicit start if provided.
  const waypoints: Waypoint[] = parsed.data.start
    ? [{ id: "__start__", lng: parsed.data.start.lng, lat: parsed.data.start.lat }, ...eligible]
    : eligible;

  const optimized = await optimizeRoute(waypoints, {
    profile: "driving",
    roundtrip: parsed.data.roundtrip ?? false,
  });
  if (!optimized) {
    return NextResponse.json({ error: "optimizer failed" }, { status: 502 });
  }

  // Strip the synthetic start so the response is just the customer stops.
  const stops = optimized.order
    .filter((w) => w.id !== "__start__")
    .map((w) => {
      const e = eligible.find((c) => c.id === w.id);
      return e
        ? { id: e.id, name: e.name, lat: e.lat, lng: e.lng }
        : { id: w.id, name: "(unknown)", lat: w.lat, lng: w.lng };
    });

  return NextResponse.json({
    ok: true,
    day: parsed.data.day,
    stops,
    distanceMeters: optimized.distanceMeters,
    durationSeconds: optimized.durationSeconds,
    geometry: optimized.geometry,
    approximate: optimized.approximate,
    totalSkipped: rows.length - eligible.length,
  });
}
