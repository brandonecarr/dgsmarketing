import { db, competitors, competitorSignals, type Competitor } from "@rosie/db";
import { and, desc, eq } from "@rosie/db";
import { AdLibraryError, searchAdLibrary, type AdArchiveItem } from "./scrapers/meta-ad-library";

export interface ScanResult {
  competitorId: string;
  emitted: number;
  reason?: string;
}

/**
 * Scan one competitor across every configured scraper. Currently: Meta Ad
 * Library only. Adds GBP photo + Google Transparency Center in future phases.
 *
 * Idempotent: emits a `new_ad` signal only for ad ids we haven't seen for this
 * competitor before.
 */
export async function scanCompetitor(opts: {
  tenantId: string;
  competitor: Competitor;
}): Promise<ScanResult> {
  const { tenantId, competitor } = opts;
  const now = new Date();

  if (!process.env.META_AD_LIBRARY_TOKEN) {
    await db.insert(competitorSignals).values({
      tenantId,
      competitorId: competitor.id,
      kind: "note",
      summary:
        "Scan attempted but META_AD_LIBRARY_TOKEN is not configured. Add the token to enable Meta Ad Library scraping.",
      payload: { reason: "no_credentials" },
      observedAt: now,
    });
    await markScanned(competitor.id, now);
    return { competitorId: competitor.id, emitted: 1, reason: "no_credentials" };
  }

  let items: AdArchiveItem[] = [];
  try {
    items = await searchAdLibrary({
      searchPageIds: competitor.metaPageId ? [competitor.metaPageId] : undefined,
      searchTerms: competitor.metaPageId ? undefined : competitor.name,
      adActiveStatus: "ALL",
      limit: 25,
    });
  } catch (e) {
    const message = e instanceof AdLibraryError ? e.message : (e as Error).message;
    await db.insert(competitorSignals).values({
      tenantId,
      competitorId: competitor.id,
      kind: "note",
      summary: `Meta Ad Library scan failed: ${message}`,
      payload: { reason: "scraper_error", message },
      observedAt: now,
    });
    await markScanned(competitor.id, now);
    return { competitorId: competitor.id, emitted: 1, reason: "scraper_error" };
  }

  // Dedupe against signals we've already emitted for this competitor.
  const known = await db
    .select({ payload: competitorSignals.payload })
    .from(competitorSignals)
    .where(
      and(
        eq(competitorSignals.tenantId, tenantId),
        eq(competitorSignals.competitorId, competitor.id),
        eq(competitorSignals.kind, "new_ad"),
      ),
    )
    .orderBy(desc(competitorSignals.observedAt))
    .limit(500);
  const seen = new Set(
    known
      .map((r) => (r.payload as { adId?: string } | null)?.adId)
      .filter((x): x is string => Boolean(x)),
  );

  const fresh = items.filter((i) => !seen.has(i.id));
  for (const ad of fresh) {
    const body = ad.adCreativeBodies?.[0] ?? "(no copy)";
    await db.insert(competitorSignals).values({
      tenantId,
      competitorId: competitor.id,
      kind: "new_ad",
      summary: `New Meta ad by ${ad.pageName ?? competitor.name}: ${body.slice(0, 200)}${body.length > 200 ? "…" : ""}`,
      payload: {
        adId: ad.id,
        pageName: ad.pageName,
        pageId: ad.pageId,
        copy: ad.adCreativeBodies,
        titles: ad.adCreativeLinkTitles,
        descriptions: ad.adCreativeLinkDescriptions,
        snapshotUrl: ad.adSnapshotUrl,
        deliveryStart: ad.adDeliveryStartTime,
        deliveryStop: ad.adDeliveryStopTime,
      },
      observedAt: ad.adDeliveryStartTime ? new Date(ad.adDeliveryStartTime) : now,
    });
  }

  if (fresh.length === 0 && items.length > 0) {
    // No new signals but the scan worked — log a heartbeat note so the operator
    // knows the integration is alive.
    await db.insert(competitorSignals).values({
      tenantId,
      competitorId: competitor.id,
      kind: "note",
      summary: `Scan complete. ${items.length} ads already tracked, nothing new.`,
      payload: { reason: "no_new_ads", scanned: items.length },
      observedAt: now,
    });
  }

  await markScanned(competitor.id, now);
  return { competitorId: competitor.id, emitted: fresh.length };
}

async function markScanned(competitorId: string, when: Date) {
  await db
    .update(competitors)
    .set({ lastScanAt: when, updatedAt: when })
    .where(eq(competitors.id, competitorId));
}
