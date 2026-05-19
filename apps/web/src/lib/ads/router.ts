import { meta } from "./meta";
import { googleAds } from "./google-ads";
import { tiktokAds } from "./tiktok-ads";
import type { AdPlatform, AdPlatformDriver } from "./types";

const REGISTRY: Record<AdPlatform, AdPlatformDriver> = {
  meta,
  google_ads: googleAds,
  tiktok: tiktokAds,
};

export function getAdDriver(platform: AdPlatform): AdPlatformDriver {
  const d = REGISTRY[platform];
  if (!d) throw new Error(`Unknown ad platform: ${platform}`);
  return d;
}

export function isAdPlatform(value: string): value is AdPlatform {
  return value === "meta" || value === "google_ads" || value === "tiktok";
}

export interface PlatformAppConfig {
  clientId: string;
  clientSecret: string;
}

export function platformAppConfig(platform: AdPlatform): PlatformAppConfig | null {
  switch (platform) {
    case "meta":
      return process.env.META_APP_ID && process.env.META_APP_SECRET
        ? { clientId: process.env.META_APP_ID, clientSecret: process.env.META_APP_SECRET }
        : null;
    case "google_ads":
      // Re-use the Google OAuth app from Phase 4 with the Ads scope.
      return process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }
        : null;
    case "tiktok":
      return process.env.TIKTOK_APP_ID && process.env.TIKTOK_APP_SECRET
        ? {
            clientId: process.env.TIKTOK_APP_ID,
            clientSecret: process.env.TIKTOK_APP_SECRET,
          }
        : null;
  }
}
