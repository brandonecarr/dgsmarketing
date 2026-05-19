import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  pgEnum,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const leadStageEnum = pgEnum("lead_stage", [
  "new",
  "engaged",
  "quoted",
  "qualified",
  "booked",
  "won",
  "lost",
]);

export const leadSourceEnum = pgEnum("lead_source", [
  "sms_inbound",
  "fb_lead_form",
  "web_form",
  "make_webhook",
  "manual",
  "import",
]);

export const STAGE_ORDER = [
  "new",
  "engaged",
  "quoted",
  "qualified",
  "booked",
  "won",
  "lost",
] as const;

export type LeadStage = (typeof STAGE_ORDER)[number];

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    name: text("name"),
    phone: text("phone"),
    email: text("email"),

    source: leadSourceEnum("source").notNull().default("manual"),
    stage: leadStageEnum("stage").notNull().default("new"),
    isCommercial: integer("is_commercial").notNull().default(0),

    /** 0–100 predictive score, populated later. */
    score: integer("score"),

    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),

    /** Free-form intake payload: service requested, zip, dogs, etc. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    /**
     * Attribution captured at intake. Each platform's id supports server-side
     * conversion dedup. event_id is the shared dedup key we send back when the
     * lead converts.
     */
    attribution: jsonb("attribution").$type<{
      eventId?: string;
      fbp?: string; // Meta browser id
      fbc?: string; // Meta click id
      gclid?: string; // Google click id
      gbraid?: string;
      wbraid?: string;
      ttclid?: string; // TikTok click id
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      utmTerm?: string;
      utmContent?: string;
      landingPageId?: string;
      qrCode?: string;
      ipAddress?: string;
      userAgent?: string;
    }>(),

    firstContactAt: timestamp("first_contact_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    wonAt: timestamp("won_at", { withTimezone: true }),
    lostAt: timestamp("lost_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStageIdx: index("leads_tenant_stage_idx").on(t.tenantId, t.stage),
    tenantLastMessageIdx: index("leads_tenant_last_message_idx").on(
      t.tenantId,
      t.lastMessageAt,
    ),
    tenantPhoneIdx: index("leads_tenant_phone_idx").on(t.tenantId, t.phone),
  }),
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
