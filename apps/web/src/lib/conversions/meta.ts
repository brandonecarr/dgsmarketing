import { hashEmail, hashName, hashPhone } from "./hash";
import { retry, transientOnly } from "@/lib/retry";
import type {
  ConversionContext,
  ConversionLead,
  PlatformConfig,
  PlatformFireResult,
} from "./types";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Meta Conversions API. Docs:
 *   https://developers.facebook.com/docs/marketing-api/conversions-api
 *
 * The eventId we send here MUST match the eventID used on the client-side
 * Pixel `fbq('track', …)` call so Meta can dedupe.
 */
export async function fireMetaConversion(
  lead: ConversionLead,
  ctx: ConversionContext,
  cfg: PlatformConfig["meta"],
  eventId: string,
): Promise<PlatformFireResult> {
  if (!cfg?.pixelId || !cfg.accessToken) {
    return { platform: "meta", status: "skipped", eventId, request: null, error: "not configured" };
  }

  const userData: Record<string, unknown> = {};
  const em = hashEmail(lead.email);
  const ph = hashPhone(lead.phone);
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (lead.attribution?.fbp) userData.fbp = lead.attribution.fbp;
  if (lead.attribution?.fbc) userData.fbc = lead.attribution.fbc;
  if (lead.attribution?.ipAddress) userData.client_ip_address = lead.attribution.ipAddress;
  if (lead.attribution?.userAgent) userData.client_user_agent = lead.attribution.userAgent;
  const fn = hashName(lead.name?.split(" ")[0]);
  const ln = hashName(lead.name?.split(" ").slice(1).join(" "));
  if (fn) userData.fn = [fn];
  if (ln) userData.ln = [ln];

  const payload = {
    data: [
      {
        event_name: ctx.eventName,
        event_time: Math.floor((lead.wonAt ?? new Date()).getTime() / 1000),
        action_source: "system_generated",
        event_id: eventId,
        user_data: userData,
        custom_data: {
          value: ctx.value,
          currency: ctx.currency ?? "USD",
        },
      },
    ],
    test_event_code: cfg.testEventCode,
  };

  try {
    const json = await retry(
      async () => {
        const res = await fetch(
          `https://graph.facebook.com/v18.0/${encodeURIComponent(cfg.pixelId)}/events?access_token=${encodeURIComponent(cfg.accessToken)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status} ${JSON.stringify(body)}`);
        return body;
      },
      { shouldRetry: transientOnly },
    );
    return { platform: "meta", status: "sent", eventId, request: payload, response: json };
  } catch (e) {
    return {
      platform: "meta",
      status: "failed",
      eventId,
      request: payload,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
