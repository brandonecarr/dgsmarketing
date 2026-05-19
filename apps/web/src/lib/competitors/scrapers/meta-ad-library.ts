/**
 * Meta Ad Library scraper using the official Graph API endpoint:
 *   https://graph.facebook.com/v18.0/ads_archive
 *
 * Requires `META_AD_LIBRARY_TOKEN` (an access token from a Meta developer
 * account approved for the Ad Library API). Free tier limits apply.
 *
 * Docs: https://www.facebook.com/ads/library/api/
 */

const BASE = "https://graph.facebook.com/v18.0/ads_archive";

export interface AdArchiveItem {
  id: string;
  pageName?: string;
  pageId?: string;
  adCreativeBodies?: string[];
  adCreativeLinkTitles?: string[];
  adCreativeLinkDescriptions?: string[];
  adCreativeLinkCaptions?: string[];
  adDeliveryStartTime?: string;
  adDeliveryStopTime?: string;
  adSnapshotUrl?: string;
}

export interface AdArchiveQuery {
  /** Free-text search across ad creative + page name. */
  searchTerms?: string;
  /** Restrict to a specific Meta Page id (numeric string). */
  searchPageIds?: string[];
  /** Country code, e.g. "US". Required by the API. */
  adReachedCountries?: string;
  /** Filter to currently-active ads only. Defaults to "ALL" so we see paused ads too. */
  adActiveStatus?: "ACTIVE" | "ALL";
  limit?: number;
}

export class AdLibraryError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AdLibraryError";
  }
}

function token(): string {
  const t = process.env.META_AD_LIBRARY_TOKEN;
  if (!t) throw new AdLibraryError("META_AD_LIBRARY_TOKEN not configured", 412);
  return t;
}

export async function searchAdLibrary(q: AdArchiveQuery): Promise<AdArchiveItem[]> {
  const params = new URLSearchParams({
    access_token: token(),
    ad_reached_countries: q.adReachedCountries ?? "US",
    ad_active_status: q.adActiveStatus ?? "ALL",
    fields: [
      "id",
      "page_name",
      "page_id",
      "ad_creative_bodies",
      "ad_creative_link_titles",
      "ad_creative_link_descriptions",
      "ad_creative_link_captions",
      "ad_delivery_start_time",
      "ad_delivery_stop_time",
      "ad_snapshot_url",
    ].join(","),
    limit: String(q.limit ?? 25),
  });
  if (q.searchTerms) params.set("search_terms", q.searchTerms);
  if (q.searchPageIds?.length) params.set("search_page_ids", q.searchPageIds.join(","));

  const res = await fetch(`${BASE}?${params.toString()}`);
  if (!res.ok) {
    throw new AdLibraryError(`Ad Library ${res.status}: ${await res.text()}`, res.status);
  }
  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      page_name?: string;
      page_id?: string;
      ad_creative_bodies?: string[];
      ad_creative_link_titles?: string[];
      ad_creative_link_descriptions?: string[];
      ad_creative_link_captions?: string[];
      ad_delivery_start_time?: string;
      ad_delivery_stop_time?: string;
      ad_snapshot_url?: string;
    }>;
  };
  return (json.data ?? []).map((d) => ({
    id: d.id,
    pageName: d.page_name,
    pageId: d.page_id,
    adCreativeBodies: d.ad_creative_bodies,
    adCreativeLinkTitles: d.ad_creative_link_titles,
    adCreativeLinkDescriptions: d.ad_creative_link_descriptions,
    adCreativeLinkCaptions: d.ad_creative_link_captions,
    adDeliveryStartTime: d.ad_delivery_start_time,
    adDeliveryStopTime: d.ad_delivery_stop_time,
    adSnapshotUrl: d.ad_snapshot_url,
  }));
}
