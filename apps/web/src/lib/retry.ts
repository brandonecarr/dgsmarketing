/**
 * Exponential-backoff retry for external API calls. Designed for outbound
 * provider work (Meta CAPI, Google Ads upload, TikTok Events, voice-vendor
 * sends) where a 5xx is usually a transient hiccup.
 *
 * Pair with `enqueueDlq()` when this finally gives up — see [[lib-dlq]].
 */
export interface RetryOptions {
  /** Total attempts including the first. Defaults to 4 (≈ 7s of wait). */
  attempts?: number;
  /** Initial backoff in ms. Default 250. */
  baseMs?: number;
  /** Cap on each individual sleep. Default 4000. */
  capMs?: number;
  /** Optional predicate — return false to skip retry on this error. */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Fires after every failed attempt; surfaces for logging/metrics. */
  onError?: (err: unknown, attempt: number, nextDelayMs: number | null) => void;
}

export async function retry<T>(op: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 4;
  const baseMs = opts.baseMs ?? 250;
  const capMs = opts.capMs ?? 4000;
  let lastErr: unknown;

  for (let i = 1; i <= attempts; i++) {
    try {
      return await op();
    } catch (e) {
      lastErr = e;
      if (opts.shouldRetry && !opts.shouldRetry(e, i)) break;
      if (i === attempts) {
        opts.onError?.(e, i, null);
        break;
      }
      // Exponential with full jitter — keeps thundering herds at bay.
      const exp = Math.min(capMs, baseMs * 2 ** (i - 1));
      const delay = Math.floor(Math.random() * exp);
      opts.onError?.(e, i, delay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * 4xx errors are usually permanent (bad input, expired token). Don't waste
 * retries on them. Pass this to `retry({ shouldRetry })`.
 */
export function transientOnly(err: unknown): boolean {
  const status = (err as { status?: number; statusCode?: number }).status ??
    (err as { statusCode?: number }).statusCode;
  if (typeof status === "number") {
    // Retry 408 (request timeout), 425 (too early), 429 (rate limit), and all 5xx.
    if (status === 408 || status === 425 || status === 429) return true;
    return status >= 500;
  }
  // Network errors don't carry a status — retry by default.
  return true;
}
