import { db, deadLetterQueue } from "@rosie/db";
import { and, desc, eq, inArray } from "@rosie/db";
import { retry, transientOnly } from "./retry";

/**
 * The set of `source` values we know how to replay. Adding a new one is two
 * steps: enqueue with the new source string, then register a replayer below.
 */
type Source =
  | "capi.meta.lead"
  | "capi.google.upload"
  | "capi.tiktok.event"
  | "cadence.send"
  | "vapi.outbound"
  | "push.notify"
  | "lead.webhook"
  | "webhook.dispatch";

interface EnqueueArgs {
  tenantId?: string;
  source: Source;
  summary?: string;
  payload: Record<string, unknown>;
  error: unknown;
  attempts?: number;
}

/**
 * Land a permanently-failed operation in the DLQ. Best-effort: if the insert
 * itself fails, log and move on — the caller already failed once and we
 * shouldn't compound that with a second exception.
 */
export async function enqueueDlq(args: EnqueueArgs): Promise<void> {
  const errStr = serializeError(args.error);
  try {
    await db.insert(deadLetterQueue).values({
      tenantId: args.tenantId,
      source: args.source,
      summary: args.summary,
      payload: args.payload,
      lastError: errStr,
      attempts: args.attempts ?? 0,
    });
  } catch (e) {
    console.error("[dlq] enqueue failed", e, "while burying", args.source, errStr);
  }
}

/**
 * Runs the op with retry-with-backoff. If every attempt fails, enqueues a DLQ
 * row and re-throws so the caller can still decide what to do. Most callers
 * will just `.catch(() => {})` because the DLQ is the only thing that matters.
 */
export async function runWithDlq<T>(
  meta: Omit<EnqueueArgs, "error" | "attempts">,
  op: () => Promise<T>,
  retryAttempts = 4,
): Promise<T> {
  let attempts = 0;
  try {
    return await retry(op, {
      attempts: retryAttempts,
      shouldRetry: transientOnly,
      onError: (_e, i) => {
        attempts = i;
      },
    });
  } catch (e) {
    await enqueueDlq({ ...meta, error: e, attempts });
    throw e;
  }
}

/**
 * Per-source replayer registry. The DLQ admin page calls `replayDlq(id)` which
 * dispatches to one of these. New `source` values must be registered here.
 */
type Replayer = (payload: Record<string, unknown>) => Promise<void>;
const REPLAYERS: Partial<Record<Source, Replayer>> = {};

export function registerReplayer(source: Source, fn: Replayer): void {
  REPLAYERS[source] = fn;
}

export async function replayDlq(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [row] = await db.select().from(deadLetterQueue).where(eq(deadLetterQueue.id, id)).limit(1);
  if (!row) return { ok: false, error: "not_found" };
  if (row.status === "resolved" || row.status === "abandoned") {
    return { ok: false, error: `status:${row.status}` };
  }
  const replayer = REPLAYERS[row.source as Source];
  if (!replayer) return { ok: false, error: `no_replayer:${row.source}` };

  await db
    .update(deadLetterQueue)
    .set({
      status: "retrying",
      replayCount: row.replayCount + 1,
      lastReplayAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(deadLetterQueue.id, id));

  try {
    await replayer(row.payload);
    await db
      .update(deadLetterQueue)
      .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
      .where(eq(deadLetterQueue.id, id));
    return { ok: true };
  } catch (e) {
    await db
      .update(deadLetterQueue)
      .set({
        status: "pending",
        lastError: serializeError(e),
        updatedAt: new Date(),
      })
      .where(eq(deadLetterQueue.id, id));
    return { ok: false, error: serializeError(e).slice(0, 200) };
  }
}

export async function resolveDlq(id: string, reason: "manual" | "abandoned") {
  await db
    .update(deadLetterQueue)
    .set({
      status: reason === "abandoned" ? "abandoned" : "resolved",
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(deadLetterQueue.id, id));
}

export async function listDlq(limit = 100) {
  return db
    .select()
    .from(deadLetterQueue)
    .where(inArray(deadLetterQueue.status, ["pending", "retrying"]))
    .orderBy(desc(deadLetterQueue.createdAt))
    .limit(limit);
}

export async function listDlqByTenant(tenantId: string, limit = 50) {
  return db
    .select()
    .from(deadLetterQueue)
    .where(
      and(
        eq(deadLetterQueue.tenantId, tenantId),
        inArray(deadLetterQueue.status, ["pending", "retrying"]),
      ),
    )
    .orderBy(desc(deadLetterQueue.createdAt))
    .limit(limit);
}

function serializeError(e: unknown): string {
  if (e instanceof Error) {
    return `${e.name}: ${e.message}${e.stack ? "\n" + e.stack.split("\n").slice(0, 6).join("\n") : ""}`;
  }
  try {
    return JSON.stringify(e).slice(0, 1000);
  } catch {
    return String(e).slice(0, 1000);
  }
}
