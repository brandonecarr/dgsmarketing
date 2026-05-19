import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db, subscriptions } from "@rosie/db";
import { eq } from "@rosie/db";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function epochToDate(s?: number | null): Date | null {
  return typeof s === "number" ? new Date(s * 1000) : null;
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const cust = typeof sub.customer === "string" ? null : sub.customer;
  const isLiveCustomer = cust && !("deleted" in cust && cust.deleted);
  const custMeta = isLiveCustomer
    ? ((cust as Stripe.Customer).metadata as Record<string, string> | undefined)
    : undefined;
  const tenantId = sub.metadata?.tenantId ?? custMeta?.tenantId;
  if (!tenantId) {
    console.warn("stripe webhook: subscription missing tenantId", sub.id);
    return;
  }

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const plan = sub.items.data[0]?.price?.lookup_key ?? sub.items.data[0]?.price?.id ?? null;
  const seats =
    sub.items.data[0]?.quantity ?? sub.metadata?.seats ? Number(sub.metadata?.seats) : 1;

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  const patch = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    plan,
    status: sub.status as
      | "trialing"
      | "active"
      | "past_due"
      | "canceled"
      | "unpaid"
      | "incomplete"
      | "incomplete_expired"
      | "paused",
    seats,
    trialEndsAt: epochToDate(sub.trial_end),
    currentPeriodStart: epochToDate(sub.current_period_start),
    currentPeriodEnd: epochToDate(sub.current_period_end),
    cancelAt: epochToDate(sub.cancel_at),
    raw: sub as unknown as Record<string, unknown>,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(subscriptions).set(patch).where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({ tenantId, ...patch });
  }
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not set" }, { status: 500 });

  const sig = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.trial_will_end":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      case "invoice.paid":
      case "invoice.payment_failed":
      case "checkout.session.completed":
        // Currently we only need subscription rows; invoice/checkout events
        // are surfaced via the Customer Portal. Add hooks here if we need them.
        break;
      default:
        // Ignore other event types.
        break;
    }
  } catch (e) {
    console.error("stripe webhook handling failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, received: event.type });
}
