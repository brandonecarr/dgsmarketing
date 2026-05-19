import { pgTable, uuid, text, jsonb, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const creativeFormatEnum = pgEnum("creative_format", ["square", "wide", "story"]);
export const creativeKindEnum = pgEnum("creative_kind", ["image", "video"]);

export const creatives = pgTable(
  "creatives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    kind: creativeKindEnum("kind").notNull().default("image"),
    format: creativeFormatEnum("format").notNull().default("square"),
    /** Display label set by the operator. */
    name: text("name"),

    /** AI provider that produced this asset, e.g. "openai:gpt-image-2". */
    provider: text("provider"),
    model: text("model"),

    /** Full prompt as sent to the model. */
    prompt: text("prompt"),
    /** Inputs from the form: visual direction, style, tone, exact ad text fields, etc. */
    inputs: jsonb("inputs").$type<{
      visualDirection?: string;
      style?: string;
      tone?: string;
      imageType?: string;
      exactAdText?: {
        headline?: string;
        body?: string;
        ctaPrimary?: string;
        ctaSecondary?: string;
        finePrint?: string;
      };
    }>(),

    /** Storage key inside the `creatives` bucket. */
    storagePath: text("storage_path"),
    /** Signed or public URL of the rendered asset. */
    url: text("url"),
    /** Token usage / cost telemetry. */
    usage: jsonb("usage"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCreatedIdx: index("creatives_tenant_created_idx").on(t.tenantId, t.createdAt),
  }),
);

export type Creative = typeof creatives.$inferSelect;
export type NewCreative = typeof creatives.$inferInsert;
