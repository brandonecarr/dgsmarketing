import { createHmac } from "node:crypto";
import {
  db,
  webhookSubscriptions,
  webhookDeliveries,
  type OutboundEvent,
} from "@rosie/db";
import { and, eq, isNull } from "@rosie/db";
import { retry, transientOnly } from "./retry";
import { enqueueDlq } from "./dlq";

const TIMEOUT_MS = 10_000;
const MAX_BODY_PREVIEW = 500;

interface DispatchOpts {
  /** Used in the X-Rosie-Event-Id header so consumers can dedupe replays. */
  idempotencyKey?: string;
}

/**
 * Fan out an event to every enabled subscription for the tenant. Each
 * destination gets:
 *   - method: POST
 *   - X-Rosie-Event: <event-type>
 *   - X-Rosie-Event-Id: <uuid>
 *   - X-Rosie-Timestamp: <unix-seconds>
 *   - X-Rosie-Signature: sha256=<hmac of "<ts>.<body>" with the subscription's secret>
 *
 * Retries with exponential backoff on transient errors (5xx / network / 429).
 * Records every attempt in `webhook_deliveries` and lands a DLQ row when the
 * final retry fails.
 */
export async function emitEvent<T extends Record<string, unknown>>(
  tenantId: string,
  event: OutboundEvent,
  payload: T,
  opts: DispatchOpts = {},
): Promise<void> {
  const subs = await db
    .select()
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.tenantId, tenantId),
        eq(webhookSubscriptions.enabled, true),
        isNull(webhookSubscriptions.suspendedAt),
      ),
    );

  const eligible = subs.filter(
    (s) => s.events.length === 0 || s.events.includes(event),
  );
  if (eligible.length === 0) return;

  const body = {
    event,
    eventId: opts.idempotencyKey ?? crypto.randomUUID(),
    deliveredAt: new Date().toISOString(),
    tenantId,
    data: payload,
  };
  const bodyStr = JSON.stringify(body);

  // Don't `await` the fan-out; the producing request shouldn't wait on
  // an operator's (potentially slow) endpoint. We do await internally so
  // we can record the delivery row, but to the caller this is fire-and-forget.
  await Promise.all(eligible.map((sub) => deliver(sub, event, body, bodyStr)));
}

async function deliver(
  sub: typeof webhookSubscriptions.$inferSelect,
  event: OutboundEvent,
  body: Record<string, unknown>,
  bodyStr: string,
): Promise<void> {
  const ts = Math.floor(Date.now() / 1000);
  const signature = sign(sub.secret, ts, bodyStr);
  let attempts = 0;
  const start = Date.now();

  try {
    const result = await retry(
      async () => {
        attempts++;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        try {
          const res = await fetch(sub.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "Rosie-Webhooks/1.0",
              "X-Rosie-Event": event,
              "X-Rosie-Event-Id": String(body.eventId),
              "X-Rosie-Timestamp": String(ts),
              "X-Rosie-Signature": signature,
            },
            body: bodyStr,
            signal: ctrl.signal,
          });
          const text = await res.text().catch(() => "");
          if (!res.ok) throw new HttpError(res.status, text.slice(0, MAX_BODY_PREVIEW));
          return { status: res.status, body: text.slice(0, MAX_BODY_PREVIEW) };
        } finally {
          clearTimeout(timer);
        }
      },
      { shouldRetry: transientOnly },
    );

    await db.insert(webhookDeliveries).values({
      tenantId: sub.tenantId,
      subscriptionId: sub.id,
      event,
      status: "delivered",
      requestBody: body,
      responseStatus: result.status,
      responseBody: result.body,
      attempts,
      durationMs: Date.now() - start,
    });
  } catch (e) {
    const err = e as HttpError | Error;
    await db.insert(webhookDeliveries).values({
      tenantId: sub.tenantId,
      subscriptionId: sub.id,
      event,
      status: "failed",
      requestBody: body,
      responseStatus: err instanceof HttpError ? err.status : null,
      responseBody: err instanceof HttpError ? err.message : null,
      error: err.message?.slice(0, 500),
      attempts,
      durationMs: Date.now() - start,
    });
    await enqueueDlq({
      tenantId: sub.tenantId,
      source: "webhook.dispatch",
      summary: `${event} → ${sub.name} failed after ${attempts} attempt(s)`,
      payload: {
        subscriptionId: sub.id,
        event,
        body,
        url: sub.url,
      },
      error: e,
      attempts,
    });
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function sign(secret: string, ts: number, body: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${ts}.${body}`);
  return `sha256=${hmac.digest("hex")}`;
}

/**
 * Verify a Rosie outbound webhook on the receiving end. Used in our test
 * harness and exposed in the docs as a copy-paste snippet for partners.
 */
export function verifyOutboundSignature(opts: {
  secret: string;
  timestamp: string;
  signature: string;
  body: string;
  toleranceSec?: number;
}): { ok: true } | { ok: false; reason: string } {
  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad timestamp" };
  const skew = Math.abs(Date.now() / 1000 - ts);
  if (skew > (opts.toleranceSec ?? 300)) return { ok: false, reason: "timestamp out of window" };

  const expected = sign(opts.secret, ts, opts.body);
  // Constant-time compare to avoid timing attacks.
  if (expected.length !== opts.signature.length) return { ok: false, reason: "length mismatch" };
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ opts.signature.charCodeAt(i);
  }
  return diff === 0 ? { ok: true } : { ok: false, reason: "signature mismatch" };
}
