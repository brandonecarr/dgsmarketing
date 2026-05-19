import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

/**
 * Sliding-window rate limiting backed by Upstash Redis.
 *
 * No-ops when UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN aren't set —
 * lets dev + early-stage prod run without Redis. Set both env vars to enable.
 */

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

const limiters = new Map<string, Ratelimit>();
function getLimiter(name: string, requests: number, windowMs: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const key = `${name}:${requests}:${windowMs}`;
  let l = limiters.get(key);
  if (!l) {
    l = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(requests, `${windowMs} ms`),
      analytics: false,
      prefix: `rl:${name}`,
    });
    limiters.set(key, l);
  }
  return l;
}

export type RateLimitTier = "api_v1" | "webhook" | "agent" | "ai_generation";

const TIERS: Record<RateLimitTier, { requests: number; windowMs: number }> = {
  api_v1: { requests: 60, windowMs: 60_000 },
  webhook: { requests: 1000, windowMs: 60_000 },
  agent: { requests: 20, windowMs: 60_000 },
  ai_generation: { requests: 30, windowMs: 60_000 },
};

export interface RateLimitResult {
  ok: boolean;
  remaining?: number;
  reset?: number;
  reason?: string;
}

export async function checkRateLimit(opts: {
  tier: RateLimitTier;
  identifier: string;
}): Promise<RateLimitResult> {
  const cfg = TIERS[opts.tier];
  const limiter = getLimiter(opts.tier, cfg.requests, cfg.windowMs);
  if (!limiter) return { ok: true }; // Redis not configured — fail open.
  try {
    const r = await limiter.limit(opts.identifier);
    return {
      ok: r.success,
      remaining: r.remaining,
      reset: r.reset,
      reason: r.success ? undefined : `Rate limit: ${cfg.requests}/min`,
    };
  } catch (e) {
    console.error("rate limit check failed (fail-open)", e);
    return { ok: true };
  }
}

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: result.reason ?? "Too many requests" },
    {
      status: 429,
      headers: {
        ...(result.reset
          ? { "Retry-After": String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))) }
          : {}),
      },
    },
  );
}
