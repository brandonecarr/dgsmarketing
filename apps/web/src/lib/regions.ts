import { createDb, type Database } from "@rosie/db";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Region registry. Each region has its own Postgres + Supabase Storage. The
 * deploy is responsible for setting the env vars below; the catalog page +
 * the regions UI surface only regions whose vars are populated.
 *
 * Env naming convention: <KEY>_<REGION_UPPER>. Example:
 *   DATABASE_URL_US, DATABASE_URL_EU, DATABASE_URL_AU
 *   NEXT_PUBLIC_SUPABASE_URL_US, NEXT_PUBLIC_SUPABASE_URL_EU, ...
 *   SUPABASE_SERVICE_ROLE_KEY_US, ...
 *
 * The legacy single-region deployment (no suffix) is always available as the
 * `us` fallback, so existing tenants keep working.
 */

export type TenantRegion = "us" | "eu" | "au";

export const REGION_LABELS: Record<TenantRegion, string> = {
  us: "United States (Virginia)",
  eu: "European Union (Frankfurt)",
  au: "Australia (Sydney)",
};

export const REGION_FLAGS: Record<TenantRegion, string> = {
  us: "🇺🇸",
  eu: "🇪🇺",
  au: "🇦🇺",
};

interface RegionConfig {
  databaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
}

function envOr(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k];
    if (v) return v;
  }
  return undefined;
}

function loadConfig(region: TenantRegion): RegionConfig | null {
  const up = region.toUpperCase();
  // Fallback chain: <KEY>_<REGION> → <KEY> (legacy single-region defaults).
  const databaseUrl = envOr(`DATABASE_URL_${up}`, "DATABASE_URL");
  const supabaseUrl = envOr(`NEXT_PUBLIC_SUPABASE_URL_${up}`, "NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = envOr(
    `NEXT_PUBLIC_SUPABASE_ANON_KEY_${up}`,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
  const supabaseServiceKey = envOr(
    `SUPABASE_SERVICE_ROLE_KEY_${up}`,
    "SUPABASE_SERVICE_ROLE_KEY",
  );
  if (!databaseUrl || !supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) return null;
  return { databaseUrl, supabaseUrl, supabaseAnonKey, supabaseServiceKey };
}

/**
 * The set of regions actually deployable from the current env. Used to filter
 * the region picker so operators can't pin to something we can't serve.
 */
export function availableRegions(): TenantRegion[] {
  return (["us", "eu", "au"] as const).filter((r) => loadConfig(r) !== null);
}

export function getRegionConfig(region: TenantRegion): RegionConfig {
  const cfg = loadConfig(region);
  if (!cfg) {
    throw new Error(
      `Region "${region}" is not configured. Set DATABASE_URL_${region.toUpperCase()} and Supabase keys.`,
    );
  }
  return cfg;
}

// ── Per-region clients, memoized ────────────────────────────────────────────

const _dbCache = new Map<TenantRegion, Database>();
const _supaCache = new Map<TenantRegion, SupabaseClient>();

/**
 * Region-aware Drizzle client. Use this for any query that operates on a
 * specific tenant's data: pass the tenant's region.
 *
 * NOTE: in deployments where every region shares one Postgres (which is the
 * default until you provision per-region clusters), all returned clients
 * point at the same DB. The signature stays region-aware so the move to
 * split clusters is a config change, not a code change.
 */
export function dbForRegion(region: TenantRegion): Database {
  const cached = _dbCache.get(region);
  if (cached) return cached;
  const cfg = getRegionConfig(region);
  const drz = createDb(cfg.databaseUrl, { max: 5 });
  _dbCache.set(region, drz);
  return drz;
}

export function supabaseAdminForRegion(region: TenantRegion): SupabaseClient {
  const cached = _supaCache.get(region);
  if (cached) return cached;
  const cfg = getRegionConfig(region);
  const client = createClient(cfg.supabaseUrl, cfg.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  _supaCache.set(region, client);
  return client;
}

/**
 * Region-aware public storage URL builder. Different regions = different
 * Supabase projects = different public storage hostnames; clients consuming
 * uploaded URLs must use the right host for the tenant.
 */
export function publicStorageUrl(region: TenantRegion, bucket: string, path: string): string {
  const cfg = getRegionConfig(region);
  return `${cfg.supabaseUrl}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;
}

/**
 * "Does this region allow contacting cross-region services?" Used by the
 * residency-only flag — when true, outbound APIs (Anthropic, OpenAI, Resend,
 * etc.) must be region-pinned variants and Tinybird ingest is suppressed for
 * non-EU events when the tenant is EU-residency.
 */
export function residencyAllowsCrossRegion(args: {
  region: TenantRegion;
  residencyOnly: boolean;
}): boolean {
  if (!args.residencyOnly) return true;
  // EU residency is the strict case today; US/AU residency means "data
  // stays here, but we still allow incidental cross-region API calls."
  return args.region !== "eu";
}
