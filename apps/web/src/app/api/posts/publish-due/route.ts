import { NextResponse } from "next/server";
import { db, posts } from "@rosie/db";
import { and, asc, eq, isNotNull, lte } from "@rosie/db";
import { getPublisher } from "@/lib/publishers/router";
import { PublisherError, type PublishPlatform } from "@/lib/publishers/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron drain for scheduled posts. Auth: `Authorization: Bearer $CRON_SECRET`.
 *
 * Picks up to 50 `posts` rows where status='scheduled' AND scheduled_for <= now,
 * calls the right publisher driver per platform, and marks each row published
 * or failed (with reason). Doesn't retry inside one run — let the next tick
 * pick up retryable failures.
 */
export async function POST(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.status, "scheduled"),
        isNotNull(posts.scheduledFor),
        lte(posts.scheduledFor, now),
      ),
    )
    .orderBy(asc(posts.scheduledFor))
    .limit(50);

  let published = 0;
  let failed = 0;
  const results: Array<{ id: string; platform: string; status: string; error?: string }> = [];

  for (const post of due) {
    try {
      const driver = getPublisher(post.platform as PublishPlatform);
      const result = await driver.publish({
        tenantId: post.tenantId,
        input: {
          body: post.body,
          title: post.title,
          mediaUrls: post.mediaPaths ?? null,
        },
      });
      await db
        .update(posts)
        .set({
          status: "published",
          publishedAt: result.publishedAt,
          externalId: result.externalId,
          updatedAt: now,
        })
        .where(eq(posts.id, post.id));
      published += 1;
      results.push({ id: post.id, platform: post.platform, status: "published" });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const retryable = e instanceof PublisherError ? e.retryable : false;
      await db
        .update(posts)
        .set({
          status: retryable ? "scheduled" : "failed",
          failureReason: message,
          updatedAt: now,
        })
        .where(eq(posts.id, post.id));
      failed += 1;
      results.push({ id: post.id, platform: post.platform, status: "failed", error: message });
    }
  }

  return NextResponse.json({ ok: true, processed: due.length, published, failed, results });
}

export async function GET(req: Request) {
  return POST(req);
}
