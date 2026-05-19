/**
 * Route optimization via Mapbox Optimization API v1.
 *
 *   https://docs.mapbox.com/api/navigation/optimization/
 *
 * The API accepts 2-12 waypoints per call. For larger routes we cluster by
 * zone (the caller passes pre-grouped stops) or fall back to a pure
 * nearest-neighbor heuristic when MAPBOX_TOKEN is missing.
 */

export interface Waypoint {
  /** Stable id the caller uses to match back to its own data. */
  id: string;
  lng: number;
  lat: number;
}

export interface OptimizedRoute {
  /** Waypoints in optimized order. */
  order: Waypoint[];
  /** Total driving distance in meters. */
  distanceMeters: number;
  /** Total driving duration in seconds. */
  durationSeconds: number;
  /** GeoJSON line of the route (for drawing on the map). */
  geometry: { type: "LineString"; coordinates: Array<[number, number]> } | null;
  /** When true, the optimizer fell back to the local nearest-neighbor heuristic. */
  approximate: boolean;
}

export async function optimizeRoute(
  waypoints: Waypoint[],
  opts: { profile?: "driving" | "driving-traffic" | "walking" | "cycling"; roundtrip?: boolean } = {},
): Promise<OptimizedRoute | null> {
  if (waypoints.length < 2) return null;
  const token = process.env.MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Fall back to local nearest-neighbor when no token, or when the route
  // is too long for one API call (Mapbox caps at 12 stops).
  if (!token || waypoints.length > 12) {
    return nearestNeighbor(waypoints, opts.roundtrip ?? false);
  }

  const profile = opts.profile ?? "driving";
  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const url =
    `https://api.mapbox.com/optimized-trips/v1/mapbox/${profile}/${coords}` +
    `?roundtrip=${opts.roundtrip ? "true" : "false"}` +
    `&source=first` +
    `&destination=${opts.roundtrip ? "any" : "last"}` +
    `&overview=full&geometries=geojson&access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return nearestNeighbor(waypoints, opts.roundtrip ?? false);
    const json = (await res.json()) as {
      trips?: Array<{
        distance: number;
        duration: number;
        geometry: { type: "LineString"; coordinates: Array<[number, number]> };
      }>;
      waypoints?: Array<{ waypoint_index: number }>;
    };
    const trip = json.trips?.[0];
    if (!trip || !json.waypoints) return nearestNeighbor(waypoints, opts.roundtrip ?? false);

    // `waypoints[i].waypoint_index` tells us where the i-th input ended up
    // in the optimized order. Re-sort original waypoints by that index.
    const ordered = [...waypoints]
      .map((w, i) => ({ w, idx: json.waypoints![i]!.waypoint_index }))
      .sort((a, b) => a.idx - b.idx)
      .map(({ w }) => w);

    return {
      order: ordered,
      distanceMeters: Math.round(trip.distance),
      durationSeconds: Math.round(trip.duration),
      geometry: trip.geometry,
      approximate: false,
    };
  } catch {
    return nearestNeighbor(waypoints, opts.roundtrip ?? false);
  }
}

/**
 * Greedy nearest-neighbor — runs locally, no API call. Useful as a fallback
 * when Mapbox is unconfigured or the stop count exceeds Mapbox's limit.
 * Distance is great-circle (Haversine) over straight lines, which is
 * conservative for road routing but produces a sensible visit order.
 */
function nearestNeighbor(waypoints: Waypoint[], roundtrip: boolean): OptimizedRoute {
  const remaining = [...waypoints];
  const order: Waypoint[] = [];
  let current = remaining.shift()!;
  order.push(current);
  let totalKm = 0;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]!);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    current = remaining.splice(bestIdx, 1)[0]!;
    order.push(current);
    totalKm += bestDist;
  }
  if (roundtrip && order.length > 1) {
    totalKm += haversineKm(order[order.length - 1]!, order[0]!);
  }
  const distanceMeters = Math.round(totalKm * 1000);
  // ~40 km/h average urban driving — rough but honest for "approximate".
  const durationSeconds = Math.round((totalKm / 40) * 3600);
  return {
    order,
    distanceMeters,
    durationSeconds,
    geometry: null,
    approximate: true,
  };
}

function haversineKm(a: Waypoint, b: Waypoint): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
