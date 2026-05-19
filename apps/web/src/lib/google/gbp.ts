import { db, integrations } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { refreshAccessToken } from "./oauth";
import { decryptJson, encryptJson } from "@/lib/crypto";

interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
}

export class GbpError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = "GbpError";
  }
}

/**
 * Returns a usable access token for the given tenant, refreshing if expired.
 * Throws GbpError if the tenant has not connected Google.
 */
export async function getAccessTokenForTenant(tenantId: string): Promise<string> {
  const rows = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, "google")))
    .limit(1);
  const row = rows[0];
  if (!row?.secrets) throw new GbpError("Google not connected for this tenant", 412);
  const stored = decryptJson<StoredTokens>(row.secrets);
  if (!stored?.accessToken) throw new GbpError("Google access token missing", 412);

  // Refresh if <60s remaining.
  if (stored.expiresAt && stored.expiresAt > Date.now() + 60_000) {
    return stored.accessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !stored.refreshToken) {
    // Can't refresh; return what we have and let the next call fail.
    return stored.accessToken;
  }

  try {
    const fresh = await refreshAccessToken({
      refreshToken: stored.refreshToken,
      clientId,
      clientSecret,
    });
    const next: StoredTokens = {
      ...stored,
      accessToken: fresh.accessToken,
      expiresAt: fresh.expiresAt,
      scope: fresh.scope,
    };
    await db
      .update(integrations)
      .set({
        secrets: encryptJson(next) as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, row.id));
    return fresh.accessToken;
  } catch (e) {
    throw new GbpError(
      `Google token refresh failed: ${e instanceof Error ? e.message : String(e)}`,
      401,
    );
  }
}

interface GbpAccount {
  name: string; // accounts/{id}
  accountName: string;
  type?: string;
}

interface GbpLocation {
  name: string; // accounts/{accountId}/locations/{locationId}
  title?: string;
  storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string };
  primaryPhone?: string;
  websiteUri?: string;
  categories?: { primaryCategory?: { displayName?: string }; additionalCategories?: { displayName?: string }[] };
  regularHours?: { periods?: unknown[] };
  metadata?: { mapsUri?: string; newReviewUri?: string };
}

interface GbpReview {
  reviewId: string;
  reviewer: { displayName?: string; profilePhotoUrl?: string };
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime: string;
  reviewReply?: { comment: string; updateTime: string };
}

async function gapi<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new GbpError(`GBP API ${res.status}: ${text}`, res.status, text);
  }
  return (await res.json()) as T;
}

export async function listAccounts(tenantId: string): Promise<GbpAccount[]> {
  const token = await getAccessTokenForTenant(tenantId);
  const data = await gapi<{ accounts?: GbpAccount[] }>(
    token,
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
  );
  return data.accounts ?? [];
}

export async function listLocations(tenantId: string, accountName: string): Promise<GbpLocation[]> {
  const token = await getAccessTokenForTenant(tenantId);
  const params = new URLSearchParams({
    readMask:
      "name,title,storefrontAddress,primaryPhone,websiteUri,categories,regularHours,metadata",
    pageSize: "20",
  });
  const data = await gapi<{ locations?: GbpLocation[] }>(
    token,
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?${params.toString()}`,
  );
  return data.locations ?? [];
}

export async function listReviews(
  tenantId: string,
  locationName: string, // accounts/{accountId}/locations/{locationId}
  pageSize = 20,
): Promise<GbpReview[]> {
  const token = await getAccessTokenForTenant(tenantId);
  // Note: GBP "v4" reviews endpoint is the legacy stable one; the new APIs are split.
  const data = await gapi<{ reviews?: GbpReview[] }>(
    token,
    `https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=${pageSize}`,
  );
  return data.reviews ?? [];
}

export async function createLocalPost(
  tenantId: string,
  locationName: string,
  body: {
    summary: string;
    callToAction?: { actionType: "LEARN_MORE" | "BOOK" | "ORDER" | "SHOP" | "SIGN_UP" | "CALL"; url?: string };
    media?: Array<{ sourceUrl: string; mediaFormat: "PHOTO" | "VIDEO" }>;
  },
): Promise<{ name: string }> {
  const token = await getAccessTokenForTenant(tenantId);
  return gapi<{ name: string }>(
    token,
    `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
    {
      method: "POST",
      body: JSON.stringify({
        languageCode: "en-US",
        ...body,
      }),
    },
  );
}

/** Field-by-field completeness derived from a fetched location. */
export function computeCompleteness(location: GbpLocation): {
  pct: number;
  fields: Array<{ key: string; label: string; ok: boolean }>;
} {
  const has = (v: unknown) => Boolean(v && (typeof v !== "string" || v.length > 0));
  const fields = [
    { key: "title", label: "Business name", ok: has(location.title) },
    {
      key: "address",
      label: "Address",
      ok: Boolean(location.storefrontAddress?.addressLines?.[0]),
    },
    { key: "phone", label: "Phone number", ok: has(location.primaryPhone) },
    { key: "website", label: "Website", ok: has(location.websiteUri) },
    {
      key: "category",
      label: "Business category",
      ok: has(location.categories?.primaryCategory?.displayName),
    },
    {
      key: "hours",
      label: "Business hours",
      ok: (location.regularHours?.periods?.length ?? 0) > 0,
    },
  ];
  const ok = fields.filter((f) => f.ok).length;
  const pct = Math.round((ok / fields.length) * 100);
  return { pct, fields };
}
