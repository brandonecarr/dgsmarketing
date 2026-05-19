import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";

/**
 * Data-residency regions. Each region maps to its own Postgres cluster +
 * Supabase Storage bucket. Adding a value here requires deploying that
 * region's infrastructure (see `lib/regions.ts` for the resolver).
 */
export const tenantRegionEnum = pgEnum("tenant_region", ["us", "eu", "au"]);
export type TenantRegion = "us" | "eu" | "au";

export const tenants = pgTable(
  "tenants",
  {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** Optional vanity host like "leads.acme.com" that points at this tenant's public pages. */
  customDomain: text("custom_domain"),
  /** Slug of the landing page that becomes the root (/) of the custom domain. */
  customDomainRootSlug: text("custom_domain_root_slug"),
  /** IANA timezone, e.g. "America/New_York". Drives all pacing + scheduling math. */
  timezone: text("timezone").notNull().default("UTC"),
  locale: text("locale").notNull().default("en-US"),
  /**
   * Data-residency region. Postgres routing, Storage bucket selection, and
   * the residency-only flag are all driven by this single column. Defaults
   * to `us` for back-compat with the original single-region deployment.
   */
  region: tenantRegionEnum("region").notNull().default("us"),
  /**
   * When true, Rosie will refuse to move this tenant's data out of its
   * region — including disabling cross-region replicas + foreign API calls
   * to non-region services. Set this for EU customers under strict GDPR.
   */
  residencyOnly: text("residency_only"),
  brandTheme: jsonb("brand_theme").$type<{
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
    sidebarColor?: string;
    backgroundColor?: string;
    /** Visible brand name to use in the UI; falls back to `tenants.name`. */
    displayName?: string;
    /** When true, hides the "Powered by Rosie" footer on public pages. */
    hidePoweredBy?: boolean;
    /** When true, renames the AI assistant in the UI to this string. */
    assistantName?: string;
    /** SMS-able number shown in the click-to-text embed widget. */
    smsNumber?: string;
    /** Google review URL used by the review-request embed widget. */
    reviewUrl?: string;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    customDomainIdx: uniqueIndex("tenants_custom_domain_idx").on(t.customDomain),
  }),
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
