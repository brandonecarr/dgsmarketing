import { db, slowQueries } from "@rosie/db";

const SLOW_MS = Number(process.env.SLOW_QUERY_MS ?? 250);

interface TimingContext {
  /** Cumulative timings keyed by label, for Server-Timing emission. */
  marks: Map<string, number>;
  /** Optional request path for slow-query attribution. */
  path?: string;
  /** Optional tenant id for slow-query attribution. */
  tenantId?: string;
}

/**
 * Wrap an async op so we can both measure it and decide whether it qualifies
 * as a slow query worth recording. Mostly intended for db calls — pass the
 * Drizzle query as the function and a short label like "leads.byStage".
 */
export async function timed<T>(
  label: string,
  op: () => Promise<T>,
  ctx?: TimingContext,
): Promise<T> {
  const start = performance.now();
  try {
    return await op();
  } finally {
    const ms = Math.round(performance.now() - start);
    if (ctx) {
      ctx.marks.set(label, (ctx.marks.get(label) ?? 0) + ms);
    }
    if (ms >= SLOW_MS) {
      // Fire-and-forget — never let logging block the request.
      db.insert(slowQueries)
        .values({
          tenantId: ctx?.tenantId,
          label,
          durationMs: ms,
          path: ctx?.path,
          sqlPreview: label.length > 500 ? label.slice(0, 500) : null,
        })
        .catch((e) => console.warn("[perf] slow_queries insert failed", e));
    }
  }
}

/**
 * Render a `Server-Timing` header value from accumulated marks. Browsers expose
 * this in DevTools' "Timing" column so we don't need a separate UI to see
 * where a request spent its time.
 */
export function serverTimingHeader(ctx: TimingContext): string {
  const parts: string[] = [];
  for (const [label, ms] of ctx.marks) {
    // The header spec disallows commas/semicolons in the name.
    const name = label.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
    parts.push(`${name};dur=${ms}`);
  }
  return parts.join(", ");
}

export function newTimingContext(opts: { path?: string; tenantId?: string } = {}): TimingContext {
  return { marks: new Map(), ...opts };
}
