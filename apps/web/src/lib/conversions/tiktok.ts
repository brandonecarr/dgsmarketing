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
 * TikTok Events API v1.3
 *   https://business-api.tiktok.com/portal/docs?id=1771101303391745
 */
export async function fireTikTokConversion(
  lead: ConversionLead,
  ctx: ConversionContext,
  cfg: PlatformConfig["tiktok"],
  eventId: string,
): Promise<PlatformFireResult> {
  if (!cfg?.pixelCode || !cfg.accessToken) {
    return { platform: "tiktok", status: "skipped", eventId, request: null, error: "not configured" };
  }

  const payload: Record<string, unknown> = {
    event_source: "web",
    event_source_id: cfg.pixelCode,
    data: [
      {
        event: ctx.eventName,
        event_id: eventId,
        event_time: Math.floor((lead.wonAt ?? new Date()).getTime() / 1000),
        user: {
          email: hashEmail(lead.email),
          phone: hashPhone(lead.phone),
          ttclid: lead.attribution?.ttclid,
          ip: lead.attribution?.ipAddress,
          user_agent: lead.attribution?.userAgent,
        },
        properties: {
          value: ctx.value,
          currency: ctx.currency ?? "USD",
        },
      },
    ],
  };
  if (cfg.testEventCode) payload.test_event_code = cfg.testEventCode;

  try {
    const json = await retry(
      async () => {
        const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
          method: "POST",
          headers: {
            "Access-Token": cfg.accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        // TikTok always returns 200 but encodes errors in `code`. Treat their
        // 5xx-like codes (40100/40200 etc.) as transient — anything else as terminal.
        if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);
        if ((body as { code?: number }).code !== 0) {
          const tk = (body as { code?: number }).code ?? 0;
          // TikTok docs: 4xxxx codes are client errors; 5xxxx server errors.
          const transientLike = tk >= 50000 || tk === 40100;
          throw new HttpError(
            transientLike ? 503 : 400,
            (body as { message?: string }).message ?? `TikTok code ${tk}`,
          );
        }
        return body;
      },
      { shouldRetry: transientOnly },
    );
    return { platform: "tiktok", status: "sent", eventId, request: payload, response: json };
  } catch (e) {
    return {
      platform: "tiktok",
      status: "failed",
      eventId,
      request: payload,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
