/**
 * Balanced k-means clustering for weekly route planning.
 *
 * Given N customers with lat/lng and K working days, partitions them into K
 * geographically-tight clusters where each cluster's size stays within a
 * tolerance band of n/k. One cluster maps to one working day.
 *
 * Math notes:
 * - K-means assumes Euclidean distance. Lat/lng degrees aren't uniform
 *   (1° longitude ≈ cos(latitude) × 1° latitude in distance). We project
 *   into equirectangular xy so the math is honest for any service area
 *   under ~100 miles wide. Continental-scale operators would need a
 *   real projection; this is a service-business tool, not a logistics
 *   provider.
 * - Initialization uses k-means++: pick the first centroid at random,
 *   then each subsequent one with probability ∝ squared distance from
 *   the nearest existing centroid. Avoids the degenerate case where two
 *   centroids start near each other.
 * - Balance enforcement: after the standard assign-then-recompute step,
 *   any oversized cluster donates its farthest-from-centroid points to
 *   the under-target cluster whose centroid sits closest to that point.
 *   Repeats until balanced or `maxBalanceSteps` hits the wall.
 */

export interface CustomerPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface ClusterResult {
  /** Customers assigned to this cluster, in arbitrary order. */
  customers: CustomerPoint[];
  /** Cluster centroid in lat/lng. */
  centroidLat: number;
  centroidLng: number;
  /** Sum of straight-line distances (km) from every customer to the centroid. */
  spreadKm: number;
}

export interface ClusteringOptions {
  k: number;
  /** Max stops per cluster as a multiplier of n/k. Default 1.3 (= 30% over avg). */
  maxImbalance?: number;
  maxIterations?: number;
  maxBalanceSteps?: number;
  /** Deterministic seed for k-means++ initialization. */
  seed?: number;
}

export interface ClusteringResult {
  clusters: ClusterResult[];
  iterations: number;
  /** True if convergence was reached before maxIterations. */
  converged: boolean;
}

const EARTH_RADIUS_KM = 6371;

export function clusterCustomers(
  points: CustomerPoint[],
  opts: ClusteringOptions,
): ClusteringResult {
  if (opts.k < 1) throw new Error("k must be >= 1");
  if (points.length === 0) {
    return { clusters: emptyClusters(opts.k), iterations: 0, converged: true };
  }

  // Cap k to the number of customers — no point asking for 5 clusters from 3
  // customers. Returns clusters padded with empties so the caller can still
  // align them to workingDays.length.
  const effectiveK = Math.min(opts.k, points.length);
  const targetSize = points.length / effectiveK;
  const maxSize = Math.ceil(targetSize * (opts.maxImbalance ?? 1.3));
  const maxIters = opts.maxIterations ?? 50;
  const maxBalance = opts.maxBalanceSteps ?? 20;

  // Project lat/lng → (x, y) in km via equirectangular about the dataset's
  // centroid. Sufficiently accurate for any single service area.
  const refLat = mean(points.map((p) => p.lat));
  const refLatRad = (refLat * Math.PI) / 180;
  const project = (p: { lat: number; lng: number }) => ({
    x: ((p.lng * Math.PI) / 180) * EARTH_RADIUS_KM * Math.cos(refLatRad),
    y: ((p.lat * Math.PI) / 180) * EARTH_RADIUS_KM,
  });
  const unproject = (xy: { x: number; y: number }) => ({
    lat: ((xy.y / EARTH_RADIUS_KM) * 180) / Math.PI,
    lng: (((xy.x / (EARTH_RADIUS_KM * Math.cos(refLatRad))) * 180) / Math.PI),
  });

  const xy = points.map(project);
  const rand = makeRand(opts.seed);

  // ── k-means++ initialization ──────────────────────────────────────────────
  const centroids: Array<{ x: number; y: number }> = [];
  centroids.push(xy[Math.floor(rand() * xy.length)]!);
  while (centroids.length < effectiveK) {
    const dists = xy.map((p) => {
      let best = Infinity;
      for (const c of centroids) {
        const d = sqDist(p, c);
        if (d < best) best = d;
      }
      return best;
    });
    const total = dists.reduce((a, b) => a + b, 0);
    if (total === 0) {
      // All remaining points coincide with existing centroids — fill the rest
      // with the first point so we don't infinite-loop.
      centroids.push(xy[0]!);
      continue;
    }
    let r = rand() * total;
    for (let i = 0; i < xy.length; i++) {
      r -= dists[i]!;
      if (r <= 0) {
        centroids.push(xy[i]!);
        break;
      }
    }
  }

  // ── Lloyd's iterations ────────────────────────────────────────────────────
  const assignments = new Array<number>(points.length).fill(0);
  let iterations = 0;
  let converged = false;
  for (; iterations < maxIters; iterations++) {
    let anyChange = false;
    // 1. Nearest-centroid assignment.
    for (let i = 0; i < xy.length; i++) {
      let bestK = 0;
      let bestDist = Infinity;
      for (let k = 0; k < effectiveK; k++) {
        const d = sqDist(xy[i]!, centroids[k]!);
        if (d < bestDist) {
          bestDist = d;
          bestK = k;
        }
      }
      if (assignments[i] !== bestK) {
        assignments[i] = bestK;
        anyChange = true;
      }
    }

    // 2. Balance — repeatedly move outliers from oversized clusters to the
    //    closest under-target cluster.
    for (let step = 0; step < maxBalance; step++) {
      const sizes = countSizes(assignments, effectiveK);
      const oversized = sizes.findIndex((s) => s > maxSize);
      if (oversized < 0) break;
      // Find the member of `oversized` farthest from its centroid; reassign.
      let worstIdx = -1;
      let worstDist = -1;
      for (let i = 0; i < xy.length; i++) {
        if (assignments[i] !== oversized) continue;
        const d = sqDist(xy[i]!, centroids[oversized]!);
        if (d > worstDist) {
          worstDist = d;
          worstIdx = i;
        }
      }
      if (worstIdx < 0) break;
      // Move to the under-target cluster whose centroid is closest.
      let bestK = -1;
      let bestDist = Infinity;
      for (let k = 0; k < effectiveK; k++) {
        if (k === oversized || sizes[k]! >= maxSize) continue;
        const d = sqDist(xy[worstIdx]!, centroids[k]!);
        if (d < bestDist) {
          bestDist = d;
          bestK = k;
        }
      }
      if (bestK < 0) break;
      assignments[worstIdx] = bestK;
      anyChange = true;
    }

    // 3. Recompute centroids.
    const sums = Array.from({ length: effectiveK }, () => ({ x: 0, y: 0, n: 0 }));
    for (let i = 0; i < xy.length; i++) {
      const k = assignments[i]!;
      sums[k]!.x += xy[i]!.x;
      sums[k]!.y += xy[i]!.y;
      sums[k]!.n += 1;
    }
    for (let k = 0; k < effectiveK; k++) {
      if (sums[k]!.n > 0) {
        centroids[k] = { x: sums[k]!.x / sums[k]!.n, y: sums[k]!.y / sums[k]!.n };
      }
    }

    if (!anyChange) {
      converged = true;
      break;
    }
  }

  // ── Build result ─────────────────────────────────────────────────────────
  const clusters: ClusterResult[] = Array.from({ length: opts.k }, (_, k) => {
    const idxs = assignments.flatMap((a, i) => (a === k ? [i] : []));
    const members = idxs.map((i) => points[i]!);
    const centroidLatLng = unproject(centroids[k] ?? { x: 0, y: 0 });
    const spreadKm = members.reduce(
      (acc, m) => acc + haversineKm(m, centroidLatLng),
      0,
    );
    return {
      customers: members,
      centroidLat: centroidLatLng.lat,
      centroidLng: centroidLatLng.lng,
      spreadKm,
    };
  });

  return { clusters, iterations, converged };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function emptyClusters(k: number): ClusterResult[] {
  return Array.from({ length: k }, () => ({
    customers: [],
    centroidLat: 0,
    centroidLng: 0,
    spreadKm: 0,
  }));
}

function sqDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function countSizes(assignments: number[], k: number): number[] {
  const sizes = new Array<number>(k).fill(0);
  for (const a of assignments) sizes[a]! += 1;
  return sizes;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Mulberry32 deterministic PRNG so seeded runs are reproducible. */
function makeRand(seed?: number): () => number {
  let s = (seed ?? Date.now()) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
