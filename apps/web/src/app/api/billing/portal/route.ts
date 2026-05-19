import { NextResponse } from "next/server";
import { db, subscriptions } from "@rosie/db";
import { eq } from "@rosie/db";
import { stripe } from "@/lib/stripe";
import { loadActiveSession } from "@/lib/active-tenant";
import { headers } from "next/headers";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST() {
  const session = await loadActiveSession();
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, session.tenant.id))
    .limit(1);
  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: "no Stripe customer yet" }, { status: 412 });
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const ret = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;

  const portal = await stripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${ret}/billing`,
  });
  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "billing.portal",
    entityType: "stripe_customer",
    entityId: sub.stripeCustomerId,
    summary: "Opened Stripe Customer Portal",
  });
  return NextResponse.json({ ok: true, url: portal.url });
}
