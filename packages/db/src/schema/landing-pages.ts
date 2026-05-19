import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  pgEnum,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const landingTemplateEnum = pgEnum("landing_template", [
  "service_hero",
  "promo",
  "review_request",
  "lead_form",
]);

export const landingStatusEnum = pgEnum("landing_status", ["draft", "published", "archived"]);

export const landingPages = pgTable(
  "landing_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** URL-safe path segment, unique per tenant; the public URL is /p/[slug]. */
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    template: landingTemplateEnum("template").notNull().default("service_hero"),
    status: landingStatusEnum("status").notNull().default("draft"),

    /** Body content. Shape depends on template. */
    content: jsonb("content").$type<{
      headline?: string;
      subhead?: string;
      bullets?: string[];
      ctaPrimary?: { label: string; href: string };
      ctaSecondary?: { label: string; href: string };
      heroImageUrl?: string;
      promoCode?: string;
      reviewUrl?: string;
      formFields?: Array<{ name: string; label: string; type: "text" | "tel" | "email" | "textarea"; required?: boolean }>;
    }>(),

    /** Theme override (color, accent, logo). Falls back to tenant brandTheme. */
    theme: jsonb("theme").$type<{
      primaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
      logoUrl?: string;
    }>(),

    /** Optional campaign linkage. The page reads campaign metadata for message-match. */
    campaignId: uuid("campaign_id"),
    /** Where leads from the page's form should be POSTed. Defaults to /api/webhooks/leads/<slug>. */
    leadWebhookUrl: text("lead_webhook_url"),

    /** Materialized counters; the source of truth is page_views. */
    viewCount: integer("view_count").notNull().default(0),
    conversionCount: integer("conversion_count").notNull().default(0),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("landing_slug_idx").on(t.slug),
    tenantStatusIdx: index("landing_tenant_status_idx").on(t.tenantId, t.status),
  }),
);

export const pageViews = pgTable(
  "page_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    landingPageId: uuid("landing_page_id").references(() => landingPages.id, {
      onDelete: "set null",
    }),
    fingerprint: text("fingerprint"),
    referer: text("referer"),
    userAgent: text("user_agent"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    /** Any QR `code` that landed here. */
    qrCode: text("qr_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pageCreatedIdx: index("page_views_page_created_idx").on(t.landingPageId, t.createdAt),
    tenantCreatedIdx: index("page_views_tenant_created_idx").on(t.tenantId, t.createdAt),
  }),
);

export type LandingPage = typeof landingPages.$inferSelect;
export type NewLandingPage = typeof landingPages.$inferInsert;
export type PageView = typeof pageViews.$inferSelect;
