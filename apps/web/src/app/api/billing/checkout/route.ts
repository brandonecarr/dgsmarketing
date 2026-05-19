import { NextResponse } from "next/server";
import { db, subscriptions } from "@rosie/db";
import { eq } from "@rosie/db";
import { PRICE_IDS, stripe } from "@/lib/stripe";
import { loadActiveSession } from "@/lib/active-tenant";
import { headers } from "next/headers";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

async function origin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function POST() {
  const session = await loadActiveSession();
  if (!PRICE_IDS.base) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_BASE not configured" },
      { status: 500 },
    );
  }

  // Reuse the tenant's Stripe customer if we've already created one.
  let [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, session.tenant.id))
    .limit(1);

  const s = stripe();
  let customerId = sub?.stripeCustomerId ?? null;
  if (!customerId) {
    const cust = await s.customers.create({
      email: session.user.email ?? undefined,
      name: session.tenant.name,
      metadata: { tenantId: session.tenant.id },
    });
    customerId = cust.id;
    if (sub) {
      await db
        .update(subscriptions)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id));
    } else {
      const inserted = await db
        .insert(subscriptions)
        .values({
          tenantId: session.tenant.id,
          stripeCustomerId: customerId,
          status: "incomplete",
        })
        .returning();
      sub = inserted[0];
    }
  }

  const base = await origin();
  const checkout = await s.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      { price: PRICE_IDS.base, quantity: 1 },
      ...(PRICE_IDS.llmOverage ? [{ price: PRICE_IDS.llmOverage }] : []),
      ...(PRICE_IDS.smsOverage ? [{ price: PRICE_IDS.smsOverage }] : []),
      ...(PRICE_IDS.imageOverage ? [{ price: PRICE_IDS.imageOverage }] : []),
    ],
    subscription_data: {
      metadata: { tenantId: session.tenant.id },
    },
    success_url: `${base}/billing?ok=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/billing?cancelled=1`,
    allow_promotion_codes: true,
  });

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "billing.checkout",
    entityType: "stripe_customer",
    entityId: customerId,
    summary: "Started Stripe checkout",
  });

  return NextResponse.json({ ok: true, url: checkout.url });
}
