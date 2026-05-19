/**
 * Tinybird push client. No-ops cleanly when TINYBIRD_TOKEN isn't set so dev +
 * pre-scale prod can ignore it. Tinybird stores these in a ClickHouse-backed
 * datasource we can query via pipes for sub-second roll-ups at scale.
 *
 * Datasource schemas (create in Tinybird UI/CLI):
 *
 *   ds_tracking_clicks
 *     tenant_id String, qr_code_id Nullable(String), fingerprint Nullable(String),
 *     country Nullable(String), occurred_at DateTime
 *
 *   ds_page_views
 *     tenant_id String, landing_page_id Nullable(String), fingerprint Nullable(String),
 *     utm_source Nullable(String), utm_medium Nullable(String),
 *     utm_campaign Nullable(String), qr_code Nullable(String),
 *     occurred_at DateTime
 *
 *   ds_usage_events
 *     tenant_id String, kind String, units Float64, cost_usd Float64,
 *     model Nullable(String), source Nullable(String), occurred_at DateTime
 *
 * Events are appended via the Events API (HFI):
 *   POST https://api.tinybird.co/v0/events?name=<datasource_name>
 */

const BASE = process.env.TINYBIRD_BASE_URL ?? "https://api.tinybird.co";

export type TinybirdDatasource =
  | "ds_tracking_clicks"
  | "ds_page_views"
  | "ds_usage_events";

interface PushOptions<T> {
  datasource: TinybirdDatasource;
  rows: T[];
}

export async function pushToTinybird<T extends Record<string, unknown>>(
  opts: PushOptions<T>,
): Promise<void> {
  const token = process.env.TINYBIRD_TOKEN;
  if (!token) return;
  if (opts.rows.length === 0) return;

  // The Events API accepts newline-delimited JSON.
  const body = opts.rows.map((r) => JSON.stringify(r)).join("\n");
  try {
    const res = await fetch(`${BASE}/v0/events?name=${encodeURIComponent(opts.datasource)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-ndjson",
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Tinybird push to ${opts.datasource} failed (${res.status}): ${text}`);
    }
  } catch (e) {
    // Never block the caller on analytics — log and move on.
    console.error("Tinybird push threw", e);
  }
}

/**
 * Convenience wrappers used by each event source. Each accepts the row shape
 * we want to land in ClickHouse — caller doesn't need to know the datasource
 * name.
 */
export async function pushTrackingClick(row: {
  tenant_id: string;
  qr_code_id: string | null;
  fingerprint?: string | null;
  country?: string | null;
}) {
  await pushToTinybird({
    datasource: "ds_tracking_clicks",
    rows: [{ ...row, occurred_at: new Date().toISOString() }],
  });
}

export async function pushPageView(row: {
  tenant_id: string;
  landing_page_id: string | null;
  fingerprint?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  qr_code?: string | null;
}) {
  await pushToTinybird({
    datasource: "ds_page_views",
    rows: [{ ...row, occurred_at: new Date().toISOString() }],
  });
}

export async function pushUsageEvent(row: {
  tenant_id: string;
  kind: string;
  units: number;
  cost_usd: number;
  model?: string | null;
  source?: string | null;
}) {
  await pushToTinybird({
    datasource: "ds_usage_events",
    rows: [{ ...row, occurred_at: new Date().toISOString() }],
  });
}
