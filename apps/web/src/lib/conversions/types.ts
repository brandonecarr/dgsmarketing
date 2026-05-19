export interface ConversionLead {
  id: string;
  tenantId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  attribution: {
    eventId?: string;
    fbp?: string;
    fbc?: string;
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
    ttclid?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    landingPageId?: string;
    ipAddress?: string;
    userAgent?: string;
  } | null;
  wonAt?: Date | null;
}

export interface ConversionContext {
  eventName: string; // "Lead", "Purchase", etc.
  /** Optional revenue/value attached to this conversion. */
  value?: number;
  currency?: string;
  /** Where in our system this fired from. */
  source: "lead_stage" | "manual" | "agent";
}

export interface PlatformConfig {
  meta?: {
    pixelId: string;
    accessToken: string;
    testEventCode?: string;
  };
  googleAds?: {
    customerId: string;
    conversionActionId: string;
    /** OAuth access token of an account with Google Ads write access. */
    accessToken: string;
    developerToken: string;
    loginCustomerId?: string;
  };
  tiktok?: {
    pixelCode: string;
    accessToken: string;
    testEventCode?: string;
  };
}

export interface PlatformFireResult {
  platform: "meta" | "google_ads" | "tiktok";
  status: "sent" | "failed" | "skipped";
  eventId: string;
  request: unknown;
  response?: unknown;
  error?: string;
}
