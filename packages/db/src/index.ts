import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Build a Drizzle client against a specific connection string. Used by
 * Phase 23's region router so a single process can talk to multiple
 * Postgres clusters (one per data-residency region).
 */
export function createDb(connectionString: string, opts?: { max?: number }) {
  const client = postgres(connectionString, {
    prepare: false,
    max: opts?.max ?? 10,
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
