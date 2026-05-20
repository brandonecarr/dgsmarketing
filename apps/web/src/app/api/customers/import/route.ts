import { NextResponse } from "next/server";
import { z } from "zod";
import { db, customers, type NewCustomer } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { geocodeAndStamp } from "@/lib/geocode";

export const runtime = "nodejs";
export const maxDuration = 300;

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

const GEOCODE_CONCURRENCY = 5;
const INSERT_BATCH_SIZE = 100;

/**
 * Bulk customer importer. The client parses the CSV and POSTs an array of
 * plain objects — we validate every row, geocode addresses in parallel
 * chunks, then issue *one* multi-row INSERT per batch.
 *
 * Previous version did one INSERT per row + sequential geocoding, which
 * exhausted the Supavisor connection pool and timed out on >25-row CSVs.
 */
export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  type Validated = { rowIndex: number; data: z.infer<typeof RowSchema> };
  type ReportItem = { ok: true; id: string } | { ok: false; rowIndex: number; error: string };
  const valid: Validated[] = [];
  const report: ReportItem[] = [];
  let failed = 0;

  // 1. Validate every row up front so the user sees all errors in one pass.
  for (let i = 0; i < parsed.data.rows.length; i++) {
    const r = RowSchema.safeParse(coerce(parsed.data.rows[i] ?? {}));
    if (r.success) {
      valid.push({ rowIndex: i, data: r.data });
    } else {
      failed++;
      report.push({
        ok: false,
        rowIndex: i,
        error: r.error.issues[0]?.message ?? "invalid",
      });
    }
  }

  // 2. Geocode in parallel chunks. Mapbox free-tier is 600 req/min; 5
  //    concurrent calls leaves headroom for normal app traffic.
  const skipGeocode = parsed.data.skipGeocode ?? false;
  const geocoded: Array<NewCustomer & { rowIndex: number }> = [];
  for (let i = 0; i < valid.length; i += GEOCODE_CONCURRENCY) {
    const chunk = valid.slice(i, i + GEOCODE_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async ({ rowIndex, data }) => {
        const base = {
          street: data.street,
          city: data.city,
          region: data.region,
          postal: data.postal,
          country: data.country,
        };
        const hasAnyAddressField = Object.values(base).some(Boolean);
        const address = hasAnyAddressField
          ? skipGeocode
            ? base
            : await geocodeAndStamp(base)
          : undefined;
        return {
          rowIndex,
          tenantId: session.tenant.id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          address,
          serviceDays: data.serviceDays ?? [],
          zone: data.zone,
          notes: data.notes,
          pricePerVisitCents: data.pricePerVisitCents,
          serviceSince: new Date(),
        } as NewCustomer & { rowIndex: number };
      }),
    );
    geocoded.push(...results);
  }

  // 3. Bulk insert — one round-trip per INSERT_BATCH_SIZE rows. Beats per-row
  //    inserts by ~100x on a 100-row CSV and avoids exhausting the pool.
  let created = 0;
  for (let i = 0; i < geocoded.length; i += INSERT_BATCH_SIZE) {
    const batch = geocoded.slice(i, i + INSERT_BATCH_SIZE);
    try {
      const inserted = await db
        .insert(customers)
        .values(batch.map(({ rowIndex: _omit, ...row }) => row))
        .returning({ id: customers.id });
      created += inserted.length;
      inserted.forEach((row) => report.push({ ok: true, id: row.id }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "insert failed";
      for (const row of batch) {
        failed++;
        report.push({ ok: false, rowIndex: row.rowIndex, error: message });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    failed,
    total: parsed.data.rows.length,
    report,
  });
}

/**
 * Map common CSV header variants to our canonical field names. Operators
 * upload exports from Google Sheets / QuickBooks / Excel with headers like
 * "Full Name", "Phone Number", "Address Line 1", "ZIP", "State" — matching
 * exactly would reject every row. We lowercase + strip non-alphanumerics
 * for the lookup so "Service Days" and "service_days" both map to
 * `serviceDays`.
 */
const HEADER_ALIASES: Record<string, string> = {
  // name
  name: "name",
  customer: "name",
  customername: "name",
  fullname: "name",
  client: "name",
  clientname: "name",
  // phone
  phone: "phone",
  phonenumber: "phone",
  mobile: "phone",
  mobilephone: "phone",
  cell: "phone",
  cellphone: "phone",
  contact: "phone",
  // email
  email: "email",
  emailaddress: "email",
  // address pieces
  street: "street",
  address: "street",
  address1: "street",
  addressline1: "street",
  streetaddress: "street",
  city: "city",
  town: "city",
  region: "region",
  state: "region",
  province: "region",
  postal: "postal",
  postalcode: "postal",
  zip: "postal",
  zipcode: "postal",
  country: "country",
  // service
  servicedays: "serviceDays",
  days: "serviceDays",
  schedule: "serviceDays",
  serviceday: "serviceDays",
  // zone / notes
  zone: "zone",
  route: "zone",
  area: "zone",
  notes: "notes",
  note: "notes",
  comment: "notes",
  comments: "notes",
  // price
  price: "pricePerVisit",
  pricepervisit: "pricePerVisit",
  pricepervisitcents: "pricePerVisitCents",
  rate: "pricePerVisit",
  cost: "pricePerVisit",
};

function canonicalKey(raw: string): string | null {
  const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  return HEADER_ALIASES[norm] ?? null;
}

/**
 * Normalize + coerce a parsed CSV row. Maps header variants to our canonical
 * field names, trims strings, parses comma-separated `serviceDays`, and
 * coerces price into integer cents.
 */
function coerce(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const canonical = canonicalKey(k);
    if (!canonical) continue;
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length === 0) continue;
      out[canonical] = t;
    } else if (v !== undefined && v !== null) {
      out[canonical] = v;
    }
  }
  if (typeof out.serviceDays === "string") {
    out.serviceDays = (out.serviceDays as string)
      .split(/[,;|/]/)
      .map((s) => s.trim().toLowerCase().slice(0, 3))
      .filter((s): s is ServiceDay => (SERVICE_DAYS as readonly string[]).includes(s));
  }
  if (typeof out.pricePerVisitCents === "string") {
    const n = Number((out.pricePerVisitCents as string).replace(/[$,]/g, ""));
    out.pricePerVisitCents = Number.isFinite(n) ? Math.round(n) : undefined;
  }
  if (typeof out.pricePerVisit === "string") {
    // Friendly alias: dollars decimal → cents. Strip $ + thousands commas.
    const n = Number((out.pricePerVisit as string).replace(/[$,]/g, ""));
    if (Number.isFinite(n)) out.pricePerVisitCents = Math.round(n * 100);
    delete out.pricePerVisit;
  }
  return out;
}
