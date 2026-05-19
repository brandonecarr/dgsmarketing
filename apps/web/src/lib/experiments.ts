import { db, experiments, experimentVariants } from "@rosie/db";
import { and, eq, sql } from "@rosie/db";

/**
 * Bandit-style variant selector. Producers call:
 *
 *   const v = await pickVariant(tenantId, "cadence:new_lead", () => seed());
 *   // v.id, v.label, v.config — use `v.config` to drive behavior.
 *   await markImpression(v.id);
 *
 * When a conversion attributable to that impression happens later:
 *
 *   await markConversion(v.id);
 *
 * The picker uses Thompson sampling — sample each variant's success-rate from a
 * Beta(α=conversions+1, β=impressions-conversions+1) distribution and pick the
 * highest sample. Naturally explores variants with few impressions and
 * exploits ones with strong track records. The operator override
 * (`is_winner`) short-circuits sampling entirely.
 */

export interface VariantHandle {
  experimentId: string;
  variantId: string;
  label: string;
  config: Record<string, unknown>;
  fresh: boolean;
}

type SeedFn = () => { name: string; surface: "cadence" | "landing_headline" | "reply_template"; goal?: string; variants: Array<{ label: string; config: Record<string, unknown> }> };

/**
 * Find — or, if missing, lazily create — the running experiment for `slug`.
 * If `seed` is provided and the experiment doesn't exist, we set it up using
 * the returned config so producers can declare experiments inline.
 */
export async function pickVariant(
  tenantId: string,
  slug: string,
  seed?: SeedFn,
): Promise<VariantHandle | null> {
  let [exp] = await db
    .select()
    .from(experiments)
    .where(and(eq(experiments.tenantId, tenantId), eq(experiments.slug, slug)))
    .limit(1);

  if (!exp && seed) {
    const config = seed();
    const [created] = await db
      .insert(experiments)
      .values({
        tenantId,
        name: config.name,
        slug,
        surface: config.surface,
        goal: config.goal,
        status: "running",
      })
      .returning();
    if (!created) return null;
    exp = created;
    if (config.variants.length > 0) {
      await db.insert(experimentVariants).values(
        config.variants.map((v) => ({
          experimentId: created.id,
          label: v.label,
          config: v.config,
        })),
      );
    }
  }
  if (!exp || exp.status !== "running") return null;

  const variants = await db
    .select()
    .from(experimentVariants)
    .where(eq(experimentVariants.experimentId, exp.id));
  if (variants.length === 0) return null;

  // Operator override beats everything.
  const winnerId = variants.find((v) => v.isWinner)?.id;
  const chosen =
    (winnerId ? variants.find((v) => v.id === winnerId) : undefined) ??
    sampleThompson(variants);
  if (!chosen) return null;

  return {
    experimentId: exp.id,
    variantId: chosen.id,
    label: chosen.label,
    config: chosen.config,
    fresh: chosen.impressions === 0,
  };
}

export async function markImpression(variantId: string): Promise<void> {
  await db
    .update(experimentVariants)
    .set({ impressions: sql`${experimentVariants.impressions} + 1` })
    .where(eq(experimentVariants.id, variantId));

  // Also bump the parent experiment counter — cheaper for the reporting UI
  // than aggregating across variant rows on every read.
  await db
    .update(experiments)
    .set({ impressions: sql`${experiments.impressions} + 1` })
    .where(
      eq(
        experiments.id,
        sql`(SELECT experiment_id FROM experiment_variants WHERE id = ${variantId})`,
      ),
    );
}

export async function markConversion(variantId: string): Promise<void> {
  await db
    .update(experimentVariants)
    .set({
      conversions: sql`${experimentVariants.conversions} + 1`,
      score: sql`(${experimentVariants.conversions} + 1)::numeric / GREATEST(${experimentVariants.impressions}, 1)`,
    })
    .where(eq(experimentVariants.id, variantId));
}

/** Sample one variant via Thompson sampling. */
function sampleThompson<V extends { impressions: number; conversions: number }>(variants: V[]): V | null {
  let best: V | null = null;
  let bestSample = -1;
  for (const v of variants) {
    const alpha = v.conversions + 1;
    const beta = v.impressions - v.conversions + 1;
    const draw = sampleBeta(alpha, beta);
    if (draw > bestSample) {
      bestSample = draw;
      best = v;
    }
  }
  return best;
}

/**
 * Approximate Beta(α, β) sample using the ratio-of-gammas method. Marsaglia &
 * Tsang's algorithm for Gamma is overkill for the small α/β we'll see; a
 * uniform-scaled Box–Muller approximation works fine.
 */
function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y);
}

function sampleGamma(shape: number): number {
  if (shape < 1) {
    // Use the Ahrens-Dieter accept-reject; for the integer-ish shapes we'll see
    // (alpha = conversions + 1, beta = impressions - conversions + 1), shape >= 1
    // almost always holds — fall through to the main case.
    return sampleGamma(shape + 1) * Math.random() ** (1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      x = randn();
      v = 1 + c * x;
    } while (v <= 0);
    v = v ** 3;
    const u = Math.random();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function randn(): number {
  // Box-Muller.
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
