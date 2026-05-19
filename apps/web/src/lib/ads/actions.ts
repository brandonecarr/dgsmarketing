import { db, adCampaigns } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { getAdDriver } from "./router";
import { loadAdCreds } from "./creds";
import { AdPlatformError, type AdPlatform } from "./types";

export interface SetCampaignStatusResult {
  ok: boolean;
  platform?: AdPlatform;
  fromStatus?: string;
  toStatus?: "active" | "paused";
  error?: string;
}

/**
 * Pauses or resumes a campaign on the underlying ad platform AND updates the
 * cached `ad_campaigns.status` so the UI/gauges reflect it immediately.
 */
export async function setCampaignStatus(opts: {
  tenantId: string;
  campaignRowId: string;
  target: "active" | "paused";
}): Promise<SetCampaignStatusResult> {
  const [campaign] = await db
    .select()
    .from(adCampaigns)
    .where(and(eq(adCampaigns.id, opts.campaignRowId), eq(adCampaigns.tenantId, opts.tenantId)))
    .limit(1);
  if (!campaign) return { ok: false, error: "campaign not found" };

  const fromStatus = campaign.status;
  const platform = campaign.platform as AdPlatform;

  try {
    const creds = await loadAdCreds(opts.tenantId, platform);
    const driver = getAdDriver(platform);
    await driver.setCampaignStatus(creds, campaign.externalId, opts.target);

    await db
      .update(adCampaigns)
      .set({ status: opts.target, updatedAt: new Date() })
      .where(eq(adCampaigns.id, campaign.id));

    return { ok: true, platform, fromStatus, toStatus: opts.target };
  } catch (e) {
    return {
      ok: false,
      platform,
      fromStatus,
      error:
        e instanceof AdPlatformError
          ? `${e.status ?? ""} ${e.message}`.trim()
          : e instanceof Error
            ? e.message
            : "unknown error",
    };
  }
}
