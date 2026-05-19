import { randomUUID } from "node:crypto";
import { db, conversionEvents, integrations } from "@rosie/db";
import { eq } from "@rosie/db";
import { fireMetaConversion } from "./meta";
import { fireGoogleConversion } from "./google";
import { fireTikTokConversion } from "./tiktok";
import { decryptJson } from "@/lib/crypto";
import { enqueueDlq, registerReplayer } from "@/lib/dlq";
import type {
  ConversionContext,
  ConversionLead,
  PlatformConfig,
  PlatformFireResult,
} from "./types";

const DLQ_SOURCE_BY_PLATFORM = {
  meta: "capi.meta.lead",
  google_ads: "capi.google.upload",
  tiktok: "capi.tiktok.event",
} as const;

interface MetaSecrets {
  pixelId?: string;
  accessToken?: string;
  testEventCode?: string;
}
interface GoogleAdsSecrets {
  customerId?: string;
  conversionActionId?: string;
  accessToken?: string;
  developerToken?: string;
  loginCustomerId?: string;
}
interface TikTokSecrets {
  pixelCode?: string;
  accessToken?: string;
  testEventCode?: string;
}

async function loadPlatformConfig(tenantId: string): Promise<PlatformConfig> {
  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.tenantId, tenantId));

  const meta = decryptJson<MetaSecrets>(rows.find((r) => r.provider === "meta")?.secrets);
  const google = decryptJson<GoogleAdsSecrets>(
    rows.find((r) => r.provider === "google_ads")?.secrets,
  );
  const tiktok = decryptJson<TikTokSecrets>(rows.find((r) => r.provider === "tiktok")?.secrets);

  return {
    meta:
      meta && meta.pixelId && meta.accessToken
        ? {
            pixelId: meta.pixelId,
            accessToken: meta.accessToken,
            testEventCode: meta.testEventCode,
          }
        : undefined,
    googleAds:
      google &&
      google.customerId &&
      google.conversionActionId &&
      google.accessToken &&
      google.developerToken
        ? {
            customerId: google.customerId,
            conversionActionId: google.conversionActionId,
            accessToken: google.accessToken,
            developerToken: google.developerToken,
            loginCustomerId: google.loginCustomerId,
          }
        : undefined,
    tiktok:
      tiktok && tiktok.pixelCode && tiktok.accessToken
        ? {
            pixelCode: tiktok.pixelCode,
            accessToken: tiktok.accessToken,
            testEventCode: tiktok.testEventCode,
          }
        : undefined,
  };
}

async function record(
  lead: ConversionLead,
  ctx: ConversionContext,
  result: PlatformFireResult,
) {
  await db.insert(conversionEvents).values({
    tenantId: lead.tenantId,
    leadId: lead.id,
    platform: result.platform,
    eventName: ctx.eventName,
    eventId: result.eventId,
    status:
      result.status === "sent" ? "sent" : result.status === "skipped" ? "skipped" : "failed",
    value: ctx.value !== undefined ? ctx.value.toString() : null,
    currency: ctx.currency ?? "USD",
    requestPayload: result.request as Record<string, unknown> | null,
    responsePayload: result.response as Record<string, unknown> | null,
    error: result.error,
    sentAt: result.status === "sent" ? new Date() : null,
  });
}

/**
 * Fire the server-side conversion to every configured platform.
 * Shared eventId across platforms keeps audit trails aligned.
 */
export async function fireWonConversion(
  lead: ConversionLead,
  ctx: ConversionContext,
): Promise<PlatformFireResult[]> {
  const cfg = await loadPlatformConfig(lead.tenantId);
  const eventId = lead.attribution?.eventId ?? randomUUID();

  const results = await Promise.all([
    fireMetaConversion(lead, ctx, cfg.meta, eventId),
    fireGoogleConversion(lead, ctx, cfg.googleAds, eventId),
    fireTikTokConversion(lead, ctx, cfg.tiktok, eventId),
  ]);

  await Promise.all(results.map((r) => record(lead, ctx, r)));

  // Any platform that returned `failed` after exhausting retries lands in the
  // DLQ so an operator can replay from /dlq.
  await Promise.all(
    results
      .filter((r) => r.status === "failed")
      .map((r) =>
        enqueueDlq({
          tenantId: lead.tenantId,
          source: DLQ_SOURCE_BY_PLATFORM[r.platform as keyof typeof DLQ_SOURCE_BY_PLATFORM],
          summary: `${r.platform} ${ctx.eventName} failed for lead ${lead.id}`,
          payload: {
            leadId: lead.id,
            tenantId: lead.tenantId,
            platform: r.platform,
            eventName: ctx.eventName,
            value: ctx.value,
            currency: ctx.currency,
            eventId: r.eventId,
          },
          error: r.error ?? "unknown",
        }),
      ),
  );
  return results;
}

// Register replayers once at module load. Each replayer re-runs the fire for
// only the requested platform.
registerReplayer("capi.meta.lead", async (payload) => replayPlatform(payload, "meta"));
registerReplayer("capi.google.upload", async (payload) => replayPlatform(payload, "google_ads"));
registerReplayer("capi.tiktok.event", async (payload) => replayPlatform(payload, "tiktok"));

async function replayPlatform(payload: Record<string, unknown>, platform: "meta" | "google_ads" | "tiktok") {
  const tenantId = String(payload.tenantId);
  const leadId = String(payload.leadId);
  const eventName = (payload.eventName as ConversionContext["eventName"]) ?? "Lead";
  const eventId = (payload.eventId as string | undefined) ?? randomUUID();

  // Hydrate the lead row.
  const { leads } = await import("@rosie/db");
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new Error(`lead ${leadId} not found`);
  if (lead.tenantId !== tenantId) throw new Error("tenant mismatch");

  const cfg = await loadPlatformConfig(tenantId);
  const conversionLead: ConversionLead = {
    id: lead.id,
    tenantId: lead.tenantId,
    name: lead.name ?? null,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    wonAt: lead.updatedAt,
    attribution: (lead.attribution as ConversionLead["attribution"]) ?? null,
  };
  const ctx: ConversionContext = {
    eventName,
    value: typeof payload.value === "number" ? payload.value : undefined,
    currency: typeof payload.currency === "string" ? payload.currency : "USD",
    source: "manual",
  };

  const result =
    platform === "meta"
      ? await fireMetaConversion(conversionLead, ctx, cfg.meta, eventId)
      : platform === "google_ads"
        ? await fireGoogleConversion(conversionLead, ctx, cfg.googleAds, eventId)
        : await fireTikTokConversion(conversionLead, ctx, cfg.tiktok, eventId);
  await record(conversionLead, ctx, result);
  if (result.status === "failed") throw new Error(result.error ?? "replay failed");
}
