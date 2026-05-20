import { NextResponse } from "next/server";
import { z } from "zod";
import { db, customers, type NewCustomer } from "@rosie/db";
import { eq } from "@rosie/db";
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
  /**
   * When true (default), rows matching an existing customer on
   * (name, email, digits-only phone) are skipped and reported as
   * `duplicate`. Pass `false` to force-insert.
   */
  dedupe: z.boolean().optional(),
});

const GEOCODE_CONCURRENCY = 5;
const INSERT_BATCH_SIZE = 100;

/** Normalize a string for dedup key construction. */
function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}
function normPhone(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}
function dedupeKey(args: { name: string; email?: string | null; phone?: string | null }): string {
  return `${norm(args.name)}|${norm(args.email)}|${normPhone(args.phone)}`;
}

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
  type ReportItem =
    | { ok: true; id: string }
    | { ok: false; rowIndex: number; error: string }
    | { ok: false; rowIndex: number; error: "duplicate"; duplicateOf?: string };
  const valid: Validated[] = [];
  const report: ReportItem[] = [];
  let failed = 0;
  let skipped = 0;

  // Pre-load every existing customer's dedupe key so we can decide row-by-row
  // without round-tripping. One SELECT beats N lookups by a mile.
  const dedupeEnabled = parsed.data.dedupe ?? true;
  const existingKeys = new Map<string, string>(); // key → existing customer id
  if (dedupeEnabled) {
    const existing = await db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
      })
      .from(customers)
      .where(eq(customers.tenantId, session.tenant.id));
    for (const c of existing) {
      existingKeys.set(dedupeKey({ name: c.name, email: c.email, phone: c.phone }), c.id);
    }
  }
  // Track dedupe keys we've already seen in *this* upload so an internally
  // duplicated CSV doesn't pass through unnoticed.
  const seenInThisUpload = new Set<string>();

  // 1. Validate every row up front so the user sees all errors in one pass.
  for (let i = 0; i < parsed.data.rows.length; i++) {
    const r = RowSchema.safeParse(coerce(parsed.data.rows[i] ?? {}));
    if (!r.success) {
      failed++;
      report.push({
        ok: false,
        rowIndex: i,
        error: r.error.issues[0]?.message ?? "invalid",
      });
      continue;
    }
    if (dedupeEnabled) {
      const key = dedupeKey({
        name: r.data.name,
        email: r.data.email,
        phone: r.data.phone,
      });
      const existingId = existingKeys.get(key);
      if (existingId) {
        skipped++;
        report.push({ ok: false, rowIndex: i, error: "duplicate", duplicateOf: existingId });
        continue;
      }
      if (seenInThisUpload.has(key)) {
        skipped++;
        report.push({ ok: false, rowIndex: i, error: "duplicate" });
        continue;
      }
      seenInThisUpload.add(key);
    }
    valid.push({ rowIndex: i, data: r.data });
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
    skipped,
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
  // first / last name — combined into `name` post-coerce.
  firstname: "firstName",
  fname: "firstName",
  givenname: "firstName",
  lastname: "lastName",
  lname: "lastName",
  surname: "lastName",
  familyname: "lastName",
  // phone — accept "Cell Phone Number", "Mobile #", "Cell Phone N" (truncated header).
  phone: "phone",
  phonenumber: "phone",
  phonen: "phone",
  mobile: "phone",
  mobilephone: "phone",
  mobilephonenumber: "phone",
  mobilen: "phone",
  cell: "phone",
  cellphone: "phone",
  cellphonenumber: "phone",
  cellphonen: "phone",
  homephone: "phone",
  workphone: "phone",
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
  propertyaddress: "street",
  serviceaddress: "street",
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
  servicefrequency: "serviceDays",
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
  // status
  status: "status",
  customerstatus: "status",
  // referral metadata — folded into notes during coerce so it isn't lost.
  referralsource: "referralSource",
  referralsourcedetails: "referralSourceDetails",
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

  // Combine First + Last → name when the source CSV doesn't have a single
  // name column. Either field alone is fine ("Cher" + missing last name).
  if (!out.name && (out.firstName || out.lastName)) {
    out.name = [out.firstName, out.lastName]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join(" ")
      .trim();
  }
  delete out.firstName;
  delete out.lastName;

  // Status normalization — operator CSVs use "Active"/"Inactive"/"Past" etc.
  if (typeof out.status === "string") {
    const s = out.status.toLowerCase();
    if (s === "active" || s === "current" || s === "on") out.status = "active";
    else if (s === "paused" || s === "inactive" || s === "hold" || s === "on hold")
      out.status = "paused";
    else if (s === "cancelled" || s === "canceled" || s === "past" || s === "lost" || s === "closed")
      out.status = "cancelled";
    else delete out.status; // Unknown value — let DB default (`active`) win.
  }

  // Fold referral context into notes so the operator doesn't lose it.
  const referralBits: string[] = [];
  if (typeof out.referralSource === "string") referralBits.push(`Referral: ${out.referralSource}`);
  if (typeof out.referralSourceDetails === "string")
    referralBits.push(out.referralSourceDetails as string);
  if (referralBits.length > 0) {
    const existing = typeof out.notes === "string" ? `${out.notes}\n` : "";
    out.notes = `${existing}${referralBits.join(" — ")}`.slice(0, 2000);
  }
  delete out.referralSource;
  delete out.referralSourceDetails;

  return out;
}
