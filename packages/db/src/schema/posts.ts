import { pgTable, uuid, text, jsonb, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const postPlatformEnum = pgEnum("post_platform", [
  "facebook",
  "instagram",
  "google_business",
  "linkedin",
  "tiktok",
]);

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "scheduled",
  "published",
  "failed",
  "cancelled",
]);

/**
 * Organic posts authored or AI-drafted in Rosie. Phase 2 stores the post;
 * Phase 3 wires up the Meta Graph publish job.
 */
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    platform: postPlatformEnum("platform").notNull().default("facebook"),
    status: postStatusEnum("status").notNull().default("draft"),

    body: text("body").notNull(),
    /** Optional headline / title for platforms that use one. */
    title: text("title"),
    /** Storage paths of attached creatives. */
    mediaPaths: jsonb("media_paths").$type<string[]>(),

    /** Brand-voice snapshot at time of authoring so we can regenerate consistently. */
    brandVoiceSnapshot: jsonb("brand_voice_snapshot"),
    /** AI metadata if drafted by Rosie: prompt, model, character ref, etc. */
    aiMeta: jsonb("ai_meta"),

    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    failureReason: text("failure_reason"),

    /** External id from the platform after publish (FB post id, etc.). */
    externalId: text("external_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantScheduledIdx: index("posts_tenant_scheduled_idx").on(t.tenantId, t.scheduledFor),
    tenantStatusIdx: index("posts_tenant_status_idx").on(t.tenantId, t.status),
  }),
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
