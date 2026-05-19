export type AdPlatform = "meta" | "google_ads" | "tiktok";

export interface OAuthExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  /** Some providers (Meta) hand back a long-lived token instead of a refresh token. */
  isLongLived?: boolean;
}

export interface AdAccountSummary {
  externalId: string;
  name: string | null;
  currency: string | null;
  timezone: string | null;
  status: string | null;
  raw?: unknown;
}

export interface CampaignSummary {
  externalId: string;
  name: string | null;
  objective: string | null;
  status: "active" | "paused" | "archived" | "deleted" | "draft" | "in_review" | "unknown";
  dailyBudget?: string;
  lifetimeBudget?: string;
  raw?: unknown;
}

export interface DailyMetricRow {
  campaignExternalId: string;
  date: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  spendUsd: number;
  conversions: number;
  revenueUsd?: number;
  raw?: unknown;
}

export interface AdPlatformCreds {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  /** Provider-specific extras (developer token, login customer id, advertiser id, etc.). */
  extras?: Record<string, unknown>;
}

export interface AdPlatformDriver {
  name: AdPlatform;
  scopes: string[];
  authUrl(opts: { clientId: string; redirectUri: string; state: string }): string;
  exchangeCode(opts: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<OAuthExchangeResult>;
  refresh?(opts: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }): Promise<OAuthExchangeResult>;
  listAccounts(creds: AdPlatformCreds): Promise<AdAccountSummary[]>;
  listCampaigns(creds: AdPlatformCreds, accountExternalId: string): Promise<CampaignSummary[]>;
  fetchDailyMetrics(opts: {
    creds: AdPlatformCreds;
    accountExternalId: string;
    sinceDate: string; // YYYY-MM-DD
    untilDate: string; // YYYY-MM-DD
  }): Promise<DailyMetricRow[]>;
  setCampaignStatus(
    creds: AdPlatformCreds,
    campaignExternalId: string,
    status: "active" | "paused",
  ): Promise<void>;
}

export class AdPlatformError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AdPlatformError";
  }
}
