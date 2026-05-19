import { db, integrations } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { AdPlatformError, type AdPlatform, type AdPlatformCreds } from "./types";
import { getAdDriver, platformAppConfig } from "./router";

const PROVIDER_MAP: Record<AdPlatform, "meta" | "google_ads" | "tiktok"> = {
  meta: "meta",
  google_ads: "google_ads",
  tiktok: "tiktok",
};

interface StoredAdCreds {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  extras?: Record<string, unknown>;
}

/**
 * Loads + decrypts a tenant's ad-platform creds, refreshing the access token
 * when expired and persisting the new token (encrypted) back to the row.
 */
export async function loadAdCreds(
  tenantId: string,
  platform: AdPlatform,
): Promise<AdPlatformCreds> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, PROVIDER_MAP[platform])))
    .limit(1);
  if (!row?.secrets) {
    throw new AdPlatformError(`${platform} not connected for this tenant`, 412);
  }
  const stored = decryptJson<StoredAdCreds>(row.secrets);
  if (!stored?.accessToken) throw new AdPlatformError(`${platform} access token missing`, 412);

  // Refresh path (Google Ads only — Meta uses a long-lived token; TikTok refresh is optional).
  const expiringSoon = stored.expiresAt && stored.expiresAt < Date.now() + 60_000;
  const driver = getAdDriver(platform);
  if (expiringSoon && stored.refreshToken && driver.refresh) {
    const app = platformAppConfig(platform);
    if (app) {
      try {
        const refreshed = await driver.refresh({
          refreshToken: stored.refreshToken,
          clientId: app.clientId,
          clientSecret: app.clientSecret,
        });
        const next: StoredAdCreds = {
          ...stored,
          accessToken: refreshed.accessToken,
          expiresAt: refreshed.expiresAt,
        };
        await db
          .update(integrations)
          .set({
            secrets: encryptJson(next) as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(integrations.id, row.id));
        return {
          accessToken: refreshed.accessToken,
          refreshToken: stored.refreshToken,
          expiresAt: refreshed.expiresAt,
          extras: stored.extras,
        };
      } catch (e) {
        console.error(`${platform} refresh failed; returning stale token`, e);
      }
    }
  }

  return {
    accessToken: stored.accessToken,
    refreshToken: stored.refreshToken,
    expiresAt: stored.expiresAt,
    extras: stored.extras,
  };
}

export async function saveAdCreds(opts: {
  tenantId: string;
  platform: AdPlatform;
  creds: StoredAdCreds;
}) {
  const provider = PROVIDER_MAP[opts.platform];
  const [existing] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.tenantId, opts.tenantId), eq(integrations.provider, provider)))
    .limit(1);

  const secrets = encryptJson(opts.creds) as unknown as Record<string, unknown>;
  if (existing) {
    await db
      .update(integrations)
      .set({ status: "connected", secrets, updatedAt: new Date() })
      .where(eq(integrations.id, existing.id));
  } else {
    await db.insert(integrations).values({
      tenantId: opts.tenantId,
      provider,
      status: "connected",
      secrets,
    });
  }
}
