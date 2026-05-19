import {
  AdPlatformError,
  type AdAccountSummary,
  type AdPlatformCreds,
  type AdPlatformDriver,
  type CampaignSummary,
  type DailyMetricRow,
  type OAuthExchangeResult,
} from "./types";

const META_API_VERSION = "v18.0";
const BASE = `https://graph.facebook.com/${META_API_VERSION}`;

async function gapi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new AdPlatformError(`Meta Ads API ${res.status}: ${text}`, res.status);
  }
  return (await res.json()) as T;
}

function mapStatus(s: string | undefined): CampaignSummary["status"] {
  switch (s) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "ARCHIVED":
      return "archived";
    case "DELETED":
      return "deleted";
    case "IN_PROCESS":
    case "WITH_ISSUES":
      return "in_review";
    default:
      return "unknown";
  }
}

export const meta: AdPlatformDriver = {
  name: "meta",
  scopes: [
    "ads_read",
    "ads_management",
    "business_management",
    "pages_show_list",
    "pages_read_engagement",
    "leads_retrieval",
  ],

  authUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: meta.scopes.join(","),
    });
    return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params.toString()}`;
  },

  async exchangeCode({ code, clientId, clientSecret, redirectUri }) {
    const short = await gapi<{
      access_token: string;
      expires_in?: number;
      token_type?: string;
    }>(
      `${BASE}/oauth/access_token?` +
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        }).toString(),
    );
    // Exchange for a long-lived user token (~60 days) so we don't need refresh.
    const long = await gapi<{ access_token: string; expires_in?: number }>(
      `${BASE}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: clientId,
          client_secret: clientSecret,
          fb_exchange_token: short.access_token,
        }).toString(),
    );
    return {
      accessToken: long.access_token,
      expiresAt: long.expires_in ? Date.now() + long.expires_in * 1000 : undefined,
      isLongLived: true,
    } satisfies OAuthExchangeResult;
  },

  async listAccounts(creds): Promise<AdAccountSummary[]> {
    const data = await gapi<{
      data?: Array<{
        id: string;
        name?: string;
        currency?: string;
        timezone_name?: string;
        account_status?: number;
      }>;
    }>(
      `${BASE}/me/adaccounts?fields=id,name,currency,timezone_name,account_status&access_token=${encodeURIComponent(creds.accessToken)}`,
    );
    return (data.data ?? []).map((a) => ({
      externalId: a.id,
      name: a.name ?? null,
      currency: a.currency ?? null,
      timezone: a.timezone_name ?? null,
      status: a.account_status === 1 ? "active" : "disabled",
      raw: a,
    }));
  },

  async listCampaigns(creds, accountExternalId) {
    const data = await gapi<{
      data?: Array<{
        id: string;
        name?: string;
        objective?: string;
        status?: string;
        daily_budget?: string;
        lifetime_budget?: string;
      }>;
    }>(
      `${BASE}/${encodeURIComponent(accountExternalId)}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget&access_token=${encodeURIComponent(creds.accessToken)}`,
    );
    return (data.data ?? []).map((c) => ({
      externalId: c.id,
      name: c.name ?? null,
      objective: c.objective ?? null,
      status: mapStatus(c.status),
      dailyBudget: c.daily_budget,
      lifetimeBudget: c.lifetime_budget,
      raw: c,
    }));
  },

  async fetchDailyMetrics({ creds, accountExternalId, sinceDate, untilDate }) {
    const data = await gapi<{
      data?: Array<{
        campaign_id?: string;
        date_start: string;
        impressions?: string;
        clicks?: string;
        spend?: string;
        conversions?: Array<{ value: string }>;
        action_values?: Array<{ value: string }>;
      }>;
    }>(
      `${BASE}/${encodeURIComponent(accountExternalId)}/insights?` +
        new URLSearchParams({
          fields: "campaign_id,impressions,clicks,spend,conversions,action_values",
          level: "campaign",
          time_increment: "1",
          time_range: JSON.stringify({ since: sinceDate, until: untilDate }),
          access_token: creds.accessToken,
        }).toString(),
    );
    return (data.data ?? [])
      .filter((r) => r.campaign_id)
      .map((r) => ({
        campaignExternalId: r.campaign_id!,
        date: r.date_start,
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        spendUsd: Number(r.spend ?? 0),
        conversions: Number(r.conversions?.[0]?.value ?? 0),
        revenueUsd: Number(r.action_values?.[0]?.value ?? 0),
        raw: r,
      }));
  },

  async setCampaignStatus(creds, campaignExternalId, status) {
    const fbStatus = status === "active" ? "ACTIVE" : "PAUSED";
    await gapi(
      `${BASE}/${encodeURIComponent(campaignExternalId)}?access_token=${encodeURIComponent(creds.accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: fbStatus }),
      },
    );
  },
};
