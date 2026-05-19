import {
  AdPlatformError,
  type AdAccountSummary,
  type AdPlatformCreds,
  type AdPlatformDriver,
  type CampaignSummary,
  type DailyMetricRow,
  type OAuthExchangeResult,
} from "./types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const ADS_API = "https://googleads.googleapis.com/v17";

function devToken(creds: AdPlatformCreds): string {
  const extras = creds.extras as { developerToken?: string } | undefined;
  const token = extras?.developerToken ?? process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!token) {
    throw new AdPlatformError(
      "Google Ads developer token missing. Set GOOGLE_ADS_DEVELOPER_TOKEN.",
      412,
    );
  }
  return token;
}

function loginCustomerHeader(creds: AdPlatformCreds): Record<string, string> {
  const extras = creds.extras as { loginCustomerId?: string } | undefined;
  return extras?.loginCustomerId ? { "login-customer-id": extras.loginCustomerId } : {};
}

async function ads<T>(creds: AdPlatformCreds, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ADS_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      "developer-token": devToken(creds),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...loginCustomerHeader(creds),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new AdPlatformError(`Google Ads ${res.status}: ${text}`, res.status);
  }
  return (await res.json()) as T;
}

function mapStatus(s: string | undefined): CampaignSummary["status"] {
  switch (s) {
    case "ENABLED":
      return "active";
    case "PAUSED":
      return "paused";
    case "REMOVED":
      return "deleted";
    default:
      return "unknown";
  }
}

export const googleAds: AdPlatformDriver = {
  name: "google_ads",
  scopes: ["https://www.googleapis.com/auth/adwords"],

  authUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      scope: googleAds.scopes.join(" "),
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, clientId, clientSecret, redirectUri }) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new AdPlatformError(`Google Ads token exchange failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
      scope: json.scope,
    } satisfies OAuthExchangeResult;
  },

  async refresh({ refreshToken, clientId, clientSecret }) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }).toString(),
    });
    if (!res.ok) throw new AdPlatformError(`Google Ads refresh failed: ${await res.text()}`);
    const json = (await res.json()) as { access_token: string; expires_in?: number };
    return {
      accessToken: json.access_token,
      expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
    };
  },

  async listAccounts(creds): Promise<AdAccountSummary[]> {
    const data = await ads<{ resourceNames?: string[] }>(creds, "/customers:listAccessibleCustomers", {
      method: "GET",
    });
    const ids = (data.resourceNames ?? []).map((rn) => rn.replace("customers/", ""));
    // No batched-info endpoint without GAQL across multiple customers; return ids
    // and let the operator pick. We surface the customer id as both name + externalId.
    return ids.map((id) => ({
      externalId: id,
      name: `Customer ${id}`,
      currency: null,
      timezone: null,
      status: "active",
      raw: { customerId: id },
    }));
  },

  async listCampaigns(creds, accountExternalId) {
    const data = await ads<{
      results?: Array<{
        campaign?: {
          id?: string;
          name?: string;
          status?: string;
          advertisingChannelType?: string;
        };
        campaignBudget?: { amountMicros?: string };
      }>;
    }>(creds, `/customers/${accountExternalId}/googleAds:searchStream`, {
      method: "POST",
      body: JSON.stringify({
        query:
          "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign_budget.amount_micros FROM campaign",
      }),
    });
    return (data.results ?? []).map((r) => {
      const c = r.campaign ?? {};
      return {
        externalId: c.id ?? "",
        name: c.name ?? null,
        objective: c.advertisingChannelType ?? null,
        status: mapStatus(c.status),
        dailyBudget: r.campaignBudget?.amountMicros
          ? String(Number(r.campaignBudget.amountMicros) / 1_000_000)
          : undefined,
        raw: r,
      };
    });
  },

  async fetchDailyMetrics({ creds, accountExternalId, sinceDate, untilDate }) {
    const data = await ads<{
      results?: Array<{
        campaign?: { id?: string };
        segments?: { date?: string };
        metrics?: {
          impressions?: string;
          clicks?: string;
          costMicros?: string;
          conversions?: string;
          conversionsValue?: string;
        };
      }>;
    }>(creds, `/customers/${accountExternalId}/googleAds:searchStream`, {
      method: "POST",
      body: JSON.stringify({
        query: `SELECT campaign.id, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${sinceDate}' AND '${untilDate}'`,
      }),
    });
    return (data.results ?? [])
      .filter((r) => r.campaign?.id && r.segments?.date)
      .map((r) => ({
        campaignExternalId: r.campaign!.id!,
        date: r.segments!.date!,
        impressions: Number(r.metrics?.impressions ?? 0),
        clicks: Number(r.metrics?.clicks ?? 0),
        spendUsd: Number(r.metrics?.costMicros ?? 0) / 1_000_000,
        conversions: Math.round(Number(r.metrics?.conversions ?? 0)),
        revenueUsd: Number(r.metrics?.conversionsValue ?? 0),
        raw: r,
      }));
  },

  async setCampaignStatus(creds, campaignExternalId, status) {
    const [customerId, , campaignId] = campaignExternalId.split("/");
    // We expect callers to pass the full resource name "customers/{cid}/campaigns/{id}"
    // OR just "{customerId}:{campaignId}". Normalize either way.
    const parts = campaignExternalId.includes("/")
      ? { customerId, campaignId }
      : (() => {
          const [a, b] = campaignExternalId.split(":");
          return { customerId: a, campaignId: b };
        })();
    if (!parts.customerId || !parts.campaignId) {
      throw new AdPlatformError("Google Ads campaignExternalId must be customerId:campaignId");
    }
    const gaStatus = status === "active" ? "ENABLED" : "PAUSED";
    await ads(creds, `/customers/${parts.customerId}/campaigns:mutate`, {
      method: "POST",
      body: JSON.stringify({
        operations: [
          {
            update: {
              resourceName: `customers/${parts.customerId}/campaigns/${parts.campaignId}`,
              status: gaStatus,
            },
            updateMask: "status",
          },
        ],
      }),
    });
  },
};
