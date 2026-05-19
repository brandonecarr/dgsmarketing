import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Granular scopes a public API key can be granted. Keys without explicit
 * scopes fall back to "leads:write" (the original behavior pre-Phase 20).
 *
 * Scope grammar: `<resource>:<action>` — keep both halves single words so
 * scope strings are easy to grep.
 */
export const API_SCOPES = [
  "leads:read",
  "leads:write",
  "conversations:read",
  "conversations:write",
  "posts:read",
  "posts:write",
  "data:export",
  "data:delete",
  "webhooks:manage",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

/**
 * Public API keys. Format: `rosie_<random>` (24-char body). We store only the
 * SHA-256 hash; the plaintext is shown to the operator once at creation.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    /** First 12 chars of the plaintext key — safe to display, helps user identify. */
    prefix: text("prefix").notNull(),
    /** SHA-256 hex of the full key. */
    keyHash: text("key_hash").notNull(),
    /**
     * Array of granted scope strings (see `API_SCOPES`). Empty/null means the
     * legacy default scope set is used so existing keys keep working.
     */
    scopes: jsonb("scopes").$type<ApiScope[]>(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("api_keys_tenant_idx").on(t.tenantId),
    keyHashIdx: uniqueIndex("api_keys_hash_idx").on(t.keyHash),
  }),
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
