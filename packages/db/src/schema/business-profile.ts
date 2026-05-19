import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const businessProfile = pgTable("business_profile", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),

  // NAP
  legalName: text("legal_name"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  address: jsonb("address").$type<{
    street?: string;
    city?: string;
    region?: string;
    postal?: string;
    country?: string;
  }>(),

  // Service info
  category: text("category"),
  services: jsonb("services").$type<string[]>(),
  serviceArea: jsonb("service_area").$type<{ zips?: string[]; cities?: string[] }>(),
  hours: jsonb("hours").$type<Record<string, { open: string; close: string } | "closed">>(),

  /** Per-tenant feature toggles (lead_assistant, auto_review, etc.). */
  features: jsonb("features").$type<{
    leadAssistantEnabled?: boolean;
    leadAssistantInstruction?: string;
    autoReviewEnabled?: boolean;
  }>(),

  // Brand voice (used by every drafting tool)
  brandVoice: jsonb("brand_voice").$type<{
    storytellingStrategy?: string;
    contentPersonality?: string;
    sellingStyle?: string;
    postLength?: string;
    guardrails?: string;
    recurringCharacters?: Array<{
      name: string;
      role: string;
      description: string;
      profile?: Record<string, unknown>;
    }>;
  }>(),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BusinessProfile = typeof businessProfile.$inferSelect;
export type NewBusinessProfile = typeof businessProfile.$inferInsert;
