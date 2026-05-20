import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Build a Drizzle client against a specific connection string. Used by
 * Phase 23's region router so a single process can talk to multiple
 * Postgres clusters (one per data-residency region).
 *
 * Pool sizing is tuned for Vercel serverless + Supabase's transaction-mode
 * pooler (Supavisor on port 6543). Defaults:
 *   - `max: 1`  → each Lambda instance keeps one connection. Supavisor's
 *                 transaction mode already multiplexes; more concurrency per
 *                 instance fights the pooler instead of helping.
 *   - `idle_timeout: 20` → free the connection after 20s idle so Supavisor
 *                          can hand it to another instance.
 *   - `connect_timeout: 10` → surface DNS/network problems in <10s instead of
 *                             stacking up until Vercel kills the function.
 *   - `prepare: false` → required for transaction-mode pooling (Supavisor
 *                        can't track prepared-statement state across txns).
 *
 * Long-lived processes (workers, dev) can pass a larger `max` to amortize
 * connection cost across requests.
 */
export function createDb(
  connectionString: string,
  opts?: { max?: number; idleTimeoutSec?: number; connectTimeoutSec?: number },
) {
  const client = postgres(connectionString, {
    prepare: false,
    max: opts?.max ?? 1,
    idle_timeout: opts?.idleTimeoutSec ?? 20,
    connect_timeout: opts?.connectTimeoutSec ?? 10,
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

// Legacy single-region default. Lazy so importing `@rosie/db` doesn't crash
// in tooling contexts where DATABASE_URL is unset (eg drizzle-kit reading
// schema files).
let _db: Database | null = null;
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    if (!_db) {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) throw new Error("DATABASE_URL is required");
      _db = createDb(connectionString);
    }
    return Reflect.get(_db as object, prop);
  },
});

export * from "./schema";
export {
  sql,
  eq,
  and,
  or,
  desc,
  asc,
  isNull,
  isNotNull,
  gt,
  gte,
  lt,
  lte,
  inArray,
  notInArray,
} from "drizzle-orm";
