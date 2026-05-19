import webpush from "web-push";
import { db, pushSubscriptions } from "@rosie/db";
import { eq, inArray } from "@rosie/db";

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com";
  if (!pub || !priv) return; // Silent no-op when not configured.
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export function pushConfigured(): boolean {
  configure();
  return configured;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Deep link opened on click. */
  url?: string;
  /** Tag groups notifications so a new lead replaces the previous "new lead" toast. */
  tag?: string;
}

/**
 * Send a notification to every browser subscribed for a tenant. Subscriptions
 * that come back as 404/410 are pruned — they're permanently dead.
 */
export async function sendPushToTenant(tenantId: string, payload: PushPayload): Promise<void> {
  configure();
  if (!configured) return;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.tenantId, tenantId));
  if (subs.length === 0) return;

  const json = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
        );
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
        else console.error("[push] send failed", code, (e as Error).message);
      }
    }),
  );

  if (dead.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
  }
}
