import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Branded QR codes. Every scan routes through `/q/[code]` so we own attribution.
 */
export const qrCodes = pgTable(
  "qr_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    /** Short slug used in the redirect URL. Globally unique. */
    code: text("code").notNull(),
    name: text("name").notNull(),
    destinationUrl: text("destination_url").notNull(),

    /** Visual config: foreground / background color, frame text, logo overlay. */
    style: jsonb("style").$type<{
      color?: string;
      background?: string;
      frameText?: string;
      logoUrl?: string;
    }>(),

    /** Storage path for the rendered PNG (lazy-rendered). */
    storagePath: text("storage_path"),

    scanCount: integer("scan_count").notNull().default(0),
    lastScanAt: timestamp("last_scan_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: uniqueIndex("qr_code_idx").on(t.code),
    tenantCreatedIdx: index("qr_tenant_created_idx").on(t.tenantId, t.createdAt),
  }),
);

/**
 * Every QR scan + short-link click. Phase 2 stores these in Postgres;
 * Phase 3 mirrors them into Tinybird/ClickHouse for the dashboards.
 */
export const trackingClicks = pgTable(
  "tracking_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    qrCodeId: uuid("qr_code_id").references(() => qrCodes.id, { onDelete: "set null" }),

    /** Anonymized fingerprint: ip-hash + ua-hash for "unique vs repeat" rough math. */
    fingerprint: text("fingerprint"),
    referer: text("referer"),
    userAgent: text("user_agent"),
    /** ISO country code if we resolve it later from the IP. */
    country: text("country"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    qrCreatedIdx: index("clicks_qr_created_idx").on(t.qrCodeId, t.createdAt),
    tenantCreatedIdx: index("clicks_tenant_created_idx").on(t.tenantId, t.createdAt),
  }),
);

export type QrCode = typeof qrCodes.$inferSelect;
export type NewQrCode = typeof qrCodes.$inferInsert;
export type TrackingClick = typeof trackingClicks.$inferSelect;
