import { NextResponse } from "next/server";
import { db, usageEvents, subscriptions, sql } from "@rosie/db";
import { and, eq, inArray, isNull } from "@rosie/db";
import { priceIdForMeter, stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily cron: aggregates unreported usage per tenant + meter, and writes one
 * Stripe usage record per (subscription_item, kind). Marks the source events
 * as reported so we never double-count.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const s = stripe();

  // Pull pending usage grouped by tenant + meter kind.
  const grouped = await db
    .select({
      tenantId: usageEvents.tenantId,
      kind: usageEvents.kind,
      units: sql<string>`coalesce(sum(${usageEvents.units}), 0)::text`,
      ids: sql<string[]>`array_agg(${usageEvents.id})`,
    })
    .from(usageEvents)
    .where(isNull(usageEvents.reportedAt))
    .groupBy(usageEvents.tenantId, usageEvents.kind);

  let reportedRows = 0;
  let reportedTenants = 0;
  for (const g of grouped) {
    const kind = g.kind === "sms_sent" ? "sms" : g.kind === "image_generated" ? "image" : g.kind === "llm_tokens" || g.kind === "llm_request" ? "llm" : null;
    if (!kind) continue;
    const priceId = priceIdForMeter(kind);
    if (!priceId) continue;

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, g.tenantId))
      .limit(1);
    if (!sub?.stripeSubscriptionId) continue;

    const subscription = await s.subscriptions.retrieve(sub.stripeSubscriptionId);
    const item = subscription.items.data.find((i) => i.price.id === priceId);
    if (!item) continue;

    const quantity =
      kind === "llm"
        ? Math.ceil(Number(g.units) / 1000) // bill per 1K tokens
        : Math.ceil(Number(g.units));
    if (quantity <= 0) continue;

    try {
      await s.subscriptionItems.createUsageRecord(item.id, {
        action: "increment",
        quantity,
        timestamp: Math.floor(Date.now() / 1000),
      });
    } catch (e) {
      console.error("stripe usage record failed", e);
      continue;
    }

    await db
      .update(usageEvents)
      .set({ reportedAt: new Date() })
      .where(
        and(
          eq(usageEvents.tenantId, g.tenantId),
          inArray(usageEvents.id, g.ids),
        ),
      );
    reportedRows += g.ids.length;
    reportedTenants += 1;
  }

  return NextResponse.json({ ok: true, reportedRows, reportedTenants });
}
