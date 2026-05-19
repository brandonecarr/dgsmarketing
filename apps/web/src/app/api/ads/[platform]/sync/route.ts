import { NextResponse } from "next/server";
import { z } from "zod";
import { db, adAccounts, adCampaigns, adMetricsDaily, tenants } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { getAdDriver, isAdPlatform } from "@/lib/ads/router";
import { loadAdCreds } from "@/lib/ads/creds";
import { AdPlatformError, type AdPlatform } from "@/lib/ads/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({ days: z.number().int().min(1).max(90).optional() });

async function authorize(req: Request): Promise<{ tenantId: string }> {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) {
    const body = (await req.clone().json().catch(() => ({}))) as { tenantId?: string };
    if (!body.tenantId) throw new Error("cron sync requires tenantId");
    return { tenantId: body.tenantId };
  }
  const session = await loadActiveSession();
  return { tenantId: session.tenant.id };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  if (!isAdPlatform(platform)) {
    return NextResponse.json({ error: "unknown platform" }, { status: 404 });
  }
  let auth;
  try {
    auth = await authorize(req);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unauthorized" },
      { status: 401 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const days = parsed.success && parsed.data.days ? parsed.data.days : 30;

  let creds;
  try {
    creds = await loadAdCreds(auth.tenantId, platform);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "creds load failed" },
      { status: e instanceof AdPlatformError ? e.status ?? 500 : 500 },
    );
  }

  const driver = getAdDriver(platform);
  const now = new Date();
  const sinceDate = isoDate(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
  const untilDate = isoDate(now);

  const summary = {
    accountsUpserted: 0,
    campaignsUpserted: 0,
    metricRows: 0,
  };

  let accounts;
  try {
    accounts = await driver.listAccounts(creds);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "listAccounts failed" },
      { status: 502 },
    );
  }

  for (const acct of accounts) {
    if (!acct.externalId) continue;
    const [accountRow] = await db
      .insert(adAccounts)
      .values({
        tenantId: auth.tenantId,
        platform: platform as AdPlatform,
        externalId: acct.externalId,
        name: acct.name,
        currency: acct.currency,
        timezone: acct.timezone,
        status: acct.status,
        raw: acct.raw as Record<string, unknown> | undefined,
        lastSyncAt: now,
      })
      .onConflictDoUpdate({
        target: [adAccounts.platform, adAccounts.externalId],
        set: {
          name: acct.name,
          currency: acct.currency,
          timezone: acct.timezone,
          status: acct.status,
          raw: acct.raw as Record<string, unknown> | undefined,
          lastSyncAt: now,
          updatedAt: now,
        },
      })
      .returning({ id: adAccounts.id });
    if (!accountRow) continue;
    summary.accountsUpserted += 1;

    let campaigns;
    try {
      campaigns = await driver.listCampaigns(creds, acct.externalId);
    } catch (e) {
      console.error(`listCampaigns ${platform} ${acct.externalId} failed`, e);
      continue;
    }

    const campaignIdByExternal = new Map<string, string>();
    for (const c of campaigns) {
      if (!c.externalId) continue;
      const [cRow] = await db
        .insert(adCampaigns)
        .values({
          tenantId: auth.tenantId,
          accountId: accountRow.id,
          platform: platform as AdPlatform,
          externalId: c.externalId,
          name: c.name,
          objective: c.objective,
          status: c.status,
          dailyBudget: c.dailyBudget,
          lifetimeBudget: c.lifetimeBudget,
          raw: c.raw as Record<string, unknown> | undefined,
          lastSyncAt: now,
        })
        .onConflictDoUpdate({
          target: [adCampaigns.platform, adCampaigns.externalId],
          set: {
            name: c.name,
            objective: c.objective,
            status: c.status,
            dailyBudget: c.dailyBudget,
            lifetimeBudget: c.lifetimeBudget,
            raw: c.raw as Record<string, unknown> | undefined,
            lastSyncAt: now,
            updatedAt: now,
          },
        })
        .returning({ id: adCampaigns.id });
      if (cRow) {
        campaignIdByExternal.set(c.externalId, cRow.id);
        summary.campaignsUpserted += 1;
      }
    }

    try {
      const metrics = await driver.fetchDailyMetrics({
        creds,
        accountExternalId: acct.externalId,
        sinceDate,
        untilDate,
      });
      for (const m of metrics) {
        const campaignId = campaignIdByExternal.get(m.campaignExternalId) ?? null;
        await db
          .insert(adMetricsDaily)
          .values({
            tenantId: auth.tenantId,
            accountId: accountRow.id,
            campaignId,
            platform: platform as AdPlatform,
            date: m.date,
            impressions: m.impressions,
            clicks: m.clicks,
            spendUsd: m.spendUsd.toString(),
            conversions: m.conversions,
            revenueUsd: (m.revenueUsd ?? 0).toString(),
            raw: m.raw as Record<string, unknown> | undefined,
          })
          .onConflictDoUpdate({
            target: [adMetricsDaily.campaignId, adMetricsDaily.date],
            set: {
              impressions: m.impressions,
              clicks: m.clicks,
              spendUsd: m.spendUsd.toString(),
              conversions: m.conversions,
              revenueUsd: (m.revenueUsd ?? 0).toString(),
              raw: m.raw as Record<string, unknown> | undefined,
            },
          });
        summary.metricRows += 1;
      }
    } catch (e) {
      console.error(`fetchDailyMetrics ${platform} ${acct.externalId} failed`, e);
    }
  }

  // Mark the tenants row updated so downstream gauge readers know to refresh.
  await db.update(tenants).set({ updatedAt: now }).where(eq(tenants.id, auth.tenantId));

  return NextResponse.json({ ok: true, platform, ...summary });
}
