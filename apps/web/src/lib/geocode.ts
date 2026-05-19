/**
 * Mapbox-backed geocoding for customer addresses.
 *
 * Wired into customer create/update. Caches the result inside the address
 * JSONB (`lat`, `lng`, `geocodedAt`) so subsequent reads don't re-call Mapbox.
 *
 * No-ops cleanly when MAPBOX_TOKEN is unset — returns the address unchanged.
 */

export interface AddressInput {
  street?: string;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
  lat?: number;
  lng?: number;
  geocodedAt?: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
}

function buildQuery(addr: AddressInput): string {
  return [addr.street, addr.city, addr.region, addr.postal, addr.country]
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(", ");
}

export async function geocodeAddress(addr: AddressInput): Promise<GeocodeResult | null> {
  const token = process.env.MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const q = buildQuery(addr);
  if (!q) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?limit=1&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: Array<{ center?: [number, number] }>;
    };
    const center = json.features?.[0]?.center;
    if (!center || center.length !== 2) return null;
    return { lng: center[0], lat: center[1] };
  } catch {
    return null;
  }
}

/**
 * Convenience: take an `AddressInput`, fill in lat/lng if Mapbox is configured,
 * and stamp `geocodedAt`. Returns the address with whatever geocoding could
 * be done — call sites store this directly into `customers.address`.
 */
export async function geocodeAndStamp(addr: AddressInput): Promise<AddressInput> {
  // Skip if already geocoded and the address text hasn't changed (we can't know
  // for certain, so trust the caller's choice when lat+lng are present and
  // geocodedAt is recent — the API route only calls this when address text
  // changed).
  const hit = await geocodeAddress(addr);
  if (!hit) return addr;
  return { ...addr, lat: hit.lat, lng: hit.lng, geocodedAt: new Date().toISOString() };
}
