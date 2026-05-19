import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { leads } from "./leads";

export const customerStatusEnum = pgEnum("customer_status", [
  "active",
  "paused",
  "cancelled",
]);

/**
 * Day-of-week tags stored inside `service_days` JSONB arrays.
 * Stored as ISO-8601 weekday abbreviations (lowercase) for readability.
 */
export type ServiceDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface CustomerAddress {
  street?: string;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
  /** Cached geocode — populated on save when MAPBOX_TOKEN is set. */
  lat?: number;
  lng?: number;
  /** ISO timestamp of the last successful geocode. */
  geocodedAt?: string;
}

/**
 * Recurring-service customers. A separate table from `leads` because the
 * lifecycle is different — once a lead is won, the customer relationship is
 * about *visits over time*, not pipeline stages.
 *
 * `serviceDays` powers the route management page: pick a day, see every
 * customer with that day in their list as a map marker.
 */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Optional link back to the lead they came from, for attribution. */
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),

    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),

    /** Address + cached geocode. */
    address: jsonb("address").$type<CustomerAddress>(),

    /** Service days, eg ["mon","thu"]. Empty array = on-demand only. */
    serviceDays: jsonb("service_days").$type<ServiceDay[]>().notNull().default([]),

    /** Optional time window string, eg "08:00-12:00". Free-form for now. */
    serviceWindow: text("service_window"),

    /** Service zone label — used by the optimizer to chunk routes >12 stops. */
    zone: text("zone"),

    status: customerStatusEnum("status").notNull().default("active"),

    /** Free-form ops notes — gate code, dog name, "ring bell first". */
    notes: text("notes"),

    /** Price per visit in cents. Used by the upcoming unit-economics phase. */
    pricePerVisitCents: integer("price_per_visit_cents"),

    /** When recurring service started. Defaults to row creation. */
    serviceSince: timestamp("service_since", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index("customers_tenant_status_idx").on(t.tenantId, t.status),
    tenantZoneIdx: index("customers_tenant_zone_idx").on(t.tenantId, t.zone),
    leadIdx: index("customers_lead_idx").on(t.leadId),
  }),
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
