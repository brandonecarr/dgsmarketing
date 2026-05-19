import {
  AdPlatformError,
  type AdAccountSummary,
  type AdPlatformCreds,
  type AdPlatformDriver,
  type CampaignSummary,
  type DailyMetricRow,
  type OAuthExchangeResult,
} from "./types";

const AUTH_URL = "https://business-api.tiktok.com/portal/auth";
const TOKEN_URL = "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/";
const API = "https://business-api.tiktok.com/open_api/v1.3";

async function tt<T>(creds: AdPlatformCreds, path: string, init?: RequestInit & { query?: Record<string, string> }): Promise<T> {
  const url = new URL(`${API}${path}`);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      "Access-Token": creds.accessToken,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new AdPlatformError(`TikTok Ads ${res.status}: ${text}`, res.status);
  }
  const json = (await res.json()) as { code?: number; message?: string; data?: T };
  if (json.code !== 0) {
    throw new AdPlatformError(`TikTok Ads code=${json.code}: ${json.message ?? "unknown"}`);
  }
  return json.data as T;
}

function mapStatus(s: string | undefined): CampaignSummary["status"] {
  switch (s) {
    case "CAMPAIGN_STATUS_ENABLE":
    case "ENABLE":
      return "active";
    case "CAMPAIGN_STATUS_DISABLE":
    case "DISABLE":
      return "paused";
    case "CAMPAIGN_STATUS_DELETE":
      return "deleted";
    default:
      return "unknown";
  }
}

export const tiktokAds: AdPlatformDriver = {
  name: "tiktok",
  scopes: ["user.info.basic", "ad.account.list", "ad.management"],

  authUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
      app_id: clientId,
      redirect_uri: redirectUri,
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, clientId, clientSecret }) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: clientId, secret: clientSecret, auth_code: code }),
    });
    if (!res.ok) throw new AdPlatformError(`TikTok token exchange failed: ${await res.text()}`);
    const json = (await res.json()) as {
      code?: number;
      message?: string;
      data?: {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        refresh_token_expires_in?: number;
      };
    };
    if (json.code !== 0 || !json.data) {
      throw new AdPlatformError(`TikTok token exchange code=${json.code}: ${json.message}`);
    }
    return {
      accessToken: json.data.access_token,
      refreshToken: json.data.refresh_token,
      expiresAt: json.data.expires_in ? Date.now() + json.data.expires_in * 1000 : undefined,
    } satisfies OAuthExchangeResult;
  },

  async listAccounts(creds): Promise<AdAccountSummary[]> {
    const extras = creds.extras as { appId?: string; secret?: string } | undefined;
    if (!extras?.appId || !extras?.secret) {
      throw new AdPlatformError("TikTok appId + secret required in creds.extras for ad account listing");
    }
    const data = await tt<{
      list?: Array<{
        advertiser_id?: string;
        advertiser_name?: string;
        currency?: string;
        timezone?: string;
        status?: string;
      }>;
    }>(creds, "/oauth2/advertiser/get/", {
      method: "GET",
      query: { access_token: creds.accessToken, app_id: extras.appId, secret: extras.secret },
    });
    return (data.list ?? []).map((a) => ({
      externalId: a.advertiser_id ?? "",
      name: a.advertiser_name ?? null,
      currency: a.currency ?? null,
      timezone: a.timezone ?? null,
      status: a.status ?? null,
      raw: a,
    }));
  },

  async listCampaigns(creds, accountExternalId) {
    const data = await tt<{
      list?: Array<{
        campaign_id?: string;
        campaign_name?: string;
        objective_type?: string;
        operation_status?: string;
        budget?: string;
        budget_mode?: string;
      }>;
    }>(creds, "/campaign/get/", {
      method: "GET",
      query: { advertiser_id: accountExternalId },
    });
    return (data.list ?? []).map((c) => ({
      externalId: c.campaign_id ?? "",
      name: c.campaign_name ?? null,
      objective: c.objective_type ?? null,
      status: mapStatus(c.operation_status),
      dailyBudget: c.budget_mode === "BUDGET_MODE_DAY" ? c.budget : undefined,
      lifetimeBudget: c.budget_mode === "BUDGET_MODE_TOTAL" ? c.budget : undefined,
      raw: c,
    }));
  },

  async fetchDailyMetrics({ creds, accountExternalId, sinceDate, untilDate }) {
    const data = await tt<{
      list?: Array<{
        dimensions?: { campaign_id?: string; stat_time_day?: string };
        metrics?: {
          impressions?: string;
          clicks?: string;
          spend?: string;
          conversion?: string;
          total_purchase_value?: string;
        };
      }>;
    }>(creds, "/report/integrated/get/", {
      method: "GET",
      query: {
        advertiser_id: accountExternalId,
        service_type: "AUCTION",
        report_type: "BASIC",
        data_level: "AUCTION_CAMPAIGN",
        dimensions: JSON.stringify(["campaign_id", "stat_time_day"]),
        metrics: JSON.stringify([
          "impressions",
          "clicks",
          "spend",
          "conversion",
          "total_purchase_value",
        ]),
        start_date: sinceDate,
        end_date: untilDate,
      },
    });
    return (data.list ?? [])
      .filter((r) => r.dimensions?.campaign_id && r.dimensions?.stat_time_day)
      .map((r) => ({
        campaignExternalId: r.dimensions!.campaign_id!,
        date: (r.dimensions!.stat_time_day ?? "").slice(0, 10),
        impressions: Number(r.metrics?.impressions ?? 0),
        clicks: Number(r.metrics?.clicks ?? 0),
        spendUsd: Number(r.metrics?.spend ?? 0),
        conversions: Math.round(Number(r.metrics?.conversion ?? 0)),
        revenueUsd: Number(r.metrics?.total_purchase_value ?? 0),
        raw: r,
      }));
  },

  async setCampaignStatus(creds, campaignExternalId, status) {
    const [advertiserId, campaignId] = campaignExternalId.split(":");
    if (!advertiserId || !campaignId) {
      throw new AdPlatformError(
        "TikTok campaignExternalId must be advertiserId:campaignId",
      );
    }
    await tt(creds, "/campaign/status/update/", {
      method: "POST",
      body: JSON.stringify({
        advertiser_id: advertiserId,
        campaign_ids: [campaignId],
        operation_status: status === "active" ? "ENABLE" : "DISABLE",
      }),
    });
  },
};
