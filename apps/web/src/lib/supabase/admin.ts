import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

/**
 * Service-role client for server-only operations that must bypass RLS:
 * uploads to storage, webhook ingest, scheduled-job writes.
 *
 * NEVER import this from a client component.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin client");
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

/** Upload a binary buffer and return the public URL. */
export async function uploadPublic(
  bucket: "creatives" | "qr" | "branding" | "voicemails",
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ path: string; publicUrl: string }> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

/**
 * Region-aware variant of {@link uploadPublic}. Use this in any handler that
 * already knows the tenant's region — uploads land in the region's Supabase
 * project, not the legacy single-region one.
 *
 * Falls back to the legacy single-region path if Phase 23 region env vars
 * aren't set yet; existing tenants keep working without an immediate redeploy.
 */
export async function uploadPublicForRegion(
  region: "us" | "eu" | "au",
  bucket: "creatives" | "qr" | "branding" | "voicemails",
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ path: string; publicUrl: string }> {
  const { supabaseAdminForRegion } = await import("@/lib/regions");
  let client;
  try {
    client = supabaseAdminForRegion(region);
  } catch {
    // Region not provisioned — fall back to the legacy single-region client.
    return uploadPublic(bucket, path, buffer, contentType);
  }
  const { error } = await client.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}
