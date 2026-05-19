import { NextResponse } from "next/server";
import { z } from "zod";
import { db, customers } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { geocodeAndStamp } from "@/lib/geocode";

export const runtime = "nodejs";
export const maxDuration = 60;

const SERVICE_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type ServiceDay = (typeof SERVICE_DAYS)[number];

const RowSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(200).optional(),
  street: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  postal: z.string().max(20).optional(),
  country: z.string().max(80).optional(),
  serviceDays: z.array(z.enum(SERVICE_DAYS)).optional(),
  zone: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
  pricePerVisitCents: z.number().int().min(0).max(10_000_000).optional(),
});

const Body = z.object({
  rows: z.array(z.record(z.unknown())).min(1).max(1000),
  /** Skip Mapbox geocoding entirely (eg you already have lat/lng). */
  skipGeocode: z.boolean().optional(),
});

/**
 * Bulk customer importer. The client parses the CSV (PapaParse / manual)
 * and POSTs an array of plain objects — we coerce + validate each row
 * server-side and return a per-row report.
 *
 * Geocoding runs sequentially with a 250ms space-out to stay under Mapbox's
 * free-tier rate limit. For huge imports, pass `skipGeocode: true` and
 * re-geocode in the background via the standard PATCH flow.
 */
export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  type ReportItem = { ok: true; id: string } | { ok: false; rowIndex: number; error: string };
  const report: ReportItem[] = [];
  let created = 0;
  let failed = 0;

  for (let i = 0; i < parsed.data.rows.length; i++) {
    const raw = parsed.data.rows[i] ?? {};
    const coerced = coerce(raw);
    const r = RowSchema.safeParse(coerced);
    if (!r.success) {
      failed++;
      report.push({
        ok: false,
        rowIndex: i,
        error: r.error.issues[0]?.message ?? "invalid",
      });
      continue;
    }
    try {
      const baseAddress = {
        street: r.data.street,
        city: r.data.city,
        region: r.data.region,
        postal: r.data.postal,
        country: r.data.country,
      };
      const hasAnyAddressField = Object.values(baseAddress).some(Boolean);
      const address = hasAnyAddressField
        ? parsed.data.skipGeocode
          ? baseAddress
          : await geocodeAndStamp(baseAddress)
        : undefined;

      const [row] = await db
        .insert(customers)
        .values({
          tenantId: session.tenant.id,
          name: r.data.name,
          phone: r.data.phone,
          email: r.data.email,
          address,
          serviceDays: r.data.serviceDays ?? [],
          zone: r.data.zone,
          notes: r.data.notes,
          pricePerVisitCents: r.data.pricePerVisitCents,
          serviceSince: new Date(),
        })
        .returning({ id: customers.id });
      if (row?.id) {
        created++;
        report.push({ ok: true, id: row.id });
      }
      // Polite delay so Mapbox doesn't 429 us mid-import.
      if (!parsed.data.skipGeocode && hasAnyAddressField) {
        await new Promise((res) => setTimeout(res, 250));
      }
    } catch (e) {
      failed++;
      report.push({
        ok: false,
        rowIndex: i,
        error: e instanceof Error ? e.message : "insert failed",
      });
    }
  }

  return NextResponse.json({ ok: true, created, failed, total: parsed.data.rows.length, report });
}

/**
 * Light type coercion for CSV-parsed rows: trim strings, parse comma-separated
 * `serviceDays`, coerce price + flatten "address" if the importer passes a
 * single freeform line.
 */
function coerce(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") {
      const t = v.trim();
      out[k] = t.length === 0 ? undefined : t;
    } else {
      out[k] = v;
    }
  }
  if (typeof out.serviceDays === "string") {
    out.serviceDays = (out.serviceDays as string)
      .split(/[,;|]/)
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is ServiceDay => (SERVICE_DAYS as readonly string[]).includes(s));
  }
  if (typeof out.pricePerVisitCents === "string") {
    const n = Number(out.pricePerVisitCents);
    out.pricePerVisitCents = Number.isFinite(n) ? Math.round(n) : undefined;
  } else if (typeof out.pricePerVisit === "string") {
    // Friendly alias: dollars decimal → cents.
    const n = Number(out.pricePerVisit);
    if (Number.isFinite(n)) out.pricePerVisitCents = Math.round(n * 100);
    delete out.pricePerVisit;
  }
  return out;
}
