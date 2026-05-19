import { hashEmail, hashPhone } from "./hash";
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
 * Google Ads — Click conversions (gclid) and Enhanced Conversions for Leads.
 *
 * Endpoint: googleads.googleapis.com/v17/customers/{customer}:uploadClickConversions
 * Auth: OAuth access token + Google Ads developer token. We don't manage Google's
 * OAuth refresh for ads here (the GBP integration's token has the wrong scopes);
 * in production each tenant connects an Ads account separately and stores the
 * Ads-scoped tokens in their own `integrations` row.
 */
export async function fireGoogleConversion(
  lead: ConversionLead,
  ctx: ConversionContext,
  cfg: PlatformConfig["googleAds"],
  eventId: string,
): Promise<PlatformFireResult> {
  if (!cfg?.customerId || !cfg.conversionActionId || !cfg.accessToken) {
    return {
      platform: "google_ads",
      status: "skipped",
      eventId,
      request: null,
      error: "not configured",
    };
  }

  // Build a single click conversion if we have a gclid; otherwise build an
  // Enhanced Conversion adjustment.
  const conversionDateTime = (lead.wonAt ?? new Date())
    .toISOString()
    .replace("T", " ")
    .replace(/\..+$/, "+00:00");

  const userIdentifiers: Array<Record<string, string>> = [];
  const em = hashEmail(lead.email);
  const ph = hashPhone(lead.phone);
  if (em) userIdentifiers.push({ hashedEmail: em });
  if (ph) userIdentifiers.push({ hashedPhoneNumber: ph });

  const conversion: Record<string, unknown> = {
    conversionAction: `customers/${cfg.customerId}/conversionActions/${cfg.conversionActionId}`,
    conversionDateTime,
    conversionValue: ctx.value,
    currencyCode: ctx.currency ?? "USD",
    orderId: eventId,
    userIdentifiers,
  };
  if (lead.attribution?.gclid) conversion.gclid = lead.attribution.gclid;
  if (lead.attribution?.gbraid) conversion.gbraid = lead.attribution.gbraid;
  if (lead.attribution?.wbraid) conversion.wbraid = lead.attribution.wbraid;

  const payload = {
    conversions: [conversion],
    partialFailure: true,
    validateOnly: false,
  };

  try {
    const json = await retry(
      async () => {
        const res = await fetch(
          `https://googleads.googleapis.com/v17/customers/${cfg.customerId}:uploadClickConversions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cfg.accessToken}`,
              "developer-token": cfg.developerToken,
              "Content-Type": "application/json",
              ...(cfg.loginCustomerId ? { "login-customer-id": cfg.loginCustomerId } : {}),
            },
            body: JSON.stringify(payload),
          },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status} ${JSON.stringify(body)}`);
        return body;
      },
      { shouldRetry: transientOnly },
    );
    return { platform: "google_ads", status: "sent", eventId, request: payload, response: json };
  } catch (e) {
    return {
      platform: "google_ads",
      status: "failed",
      eventId,
      request: payload,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
