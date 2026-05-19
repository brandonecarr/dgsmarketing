import { NextResponse } from "next/server";
import { z } from "zod";
import { db, customers } from "@rosie/db";
import { and, eq, sql } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

export const runtime = "nodejs";

const DayParam = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

/**
 * Returns every active customer scheduled for the given day, in arbitrary order
 * (the map renders them as markers; the optimize endpoint sorts them). Includes
 * coords + a `hasGeocode` flag so the UI can warn about un-mappable customers.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ day: string }> },
) {
  const session = await loadActiveSession();
  const { day: dayRaw } = await params;
  const parsed = DayParam.safeParse(dayRaw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid day" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      address: customers.address,
      serviceWindow: customers.serviceWindow,
      zone: customers.zone,
      notes: customers.notes,
    })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, session.tenant.id),
        eq(customers.status, "active"),
        sql`${customers.serviceDays} @> ${JSON.stringify([parsed.data])}::jsonb`,
      ),
    )
    .orderBy(customers.zone, customers.name);

  return NextResponse.json({
    day: parsed.data,
    stops: rows.map((r) => {
      const addr = (r.address ?? {}) as { lat?: number; lng?: number; city?: string };
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        city: addr.city ?? null,
        lat: typeof addr.lat === "number" ? addr.lat : null,
        lng: typeof addr.lng === "number" ? addr.lng : null,
        hasGeocode: typeof addr.lat === "number" && typeof addr.lng === "number",
        serviceWindow: r.serviceWindow,
        zone: r.zone,
        notes: r.notes,
      };
    }),
  });
}
