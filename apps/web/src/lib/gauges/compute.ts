import { and, eq, gte, lt, sql } from "@rosie/db";
import {
  db,
  leads,
  conversations,
  messages,
  posts,
  qrCodes,
  kpis,
  kpiValues,
  businessProfile,
  tenants,
  adMetricsDaily,
} from "@rosie/db";
import {
  type GaugeCluster,
  type GaugeResult,
  gradeFromScore,
  statusFromScore,
} from "./types";
import {
  monthStart as tzMonthStart,
  monthEnd as tzMonthEnd,
  daysInMonth as tzDaysInMonth,
  dayOfMonth as tzDayOfMonth,
} from "../timezone";

async function tenantTimezone(tenantId: string): Promise<string> {
  const [row] = await db
    .select({ tz: tenants.timezone })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return row?.tz ?? "UTC";
}

interface RawCounts {
  leadsThisMonth: number;
  leadsPriorMonth: number;
  leadsLast7Days: number;
  leadsPrior7Days: number;
  wonThisMonth: number;
  postsLast30Days: number;
  qrScansLast30Days: number;
  conversationsThisMonth: number;
  outboundLast30Days: number;
  /** Aggregated ad-platform metrics for the last 30 days (null if no data). */
  ads30d: {
    spendUsd: number;
    impressions: number;
    clicks: number;
    conversions: number;
  } | null;
}

async function getRawCounts(tenantId: string, tz: string, now = new Date()): Promise<RawCounts> {
  const ms = tzMonthStart(now, tz);
  const me = tzMonthEnd(now, tz);
  const priorMs = tzMonthStart(new Date(ms.getTime() - 1), tz);
  const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prior14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    [leadsThis],
    [leadsPrior],
    [leads7],
    [leadsPrior7],
    [wonThis],
    [postsRow],
    [qrRow],
    [convThis],
    [outboundRow],
  ] = await Promise.all([
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), gte(leads.createdAt, ms), lt(leads.createdAt, me))),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), gte(leads.createdAt, priorMs), lt(leads.createdAt, ms))),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), gte(leads.createdAt, last7))),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), gte(leads.createdAt, prior14), lt(leads.createdAt, last7))),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          eq(leads.stage, "won"),
          gte(leads.wonAt, ms),
          lt(leads.wonAt, me),
        ),
      ),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(posts)
      .where(and(eq(posts.tenantId, tenantId), gte(posts.createdAt, last30))),
    db
      .select({ c: sql<number>`coalesce(sum(scan_count),0)::int` })
      .from(qrCodes)
      .where(and(eq(qrCodes.tenantId, tenantId), gte(qrCodes.createdAt, last30))),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(conversations)
      .where(and(eq(conversations.tenantId, tenantId), gte(conversations.createdAt, ms))),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenantId),
          eq(messages.direction, "outbound"),
          gte(messages.createdAt, last30),
        ),
      ),
  ]);

  // Aggregate the last 30 days of ad metrics across all platforms.
  const last30Iso = last30.toISOString().slice(0, 10);
  const [adsRow] = await db
    .select({
      spend: sql<string>`coalesce(sum(${adMetricsDaily.spendUsd}), 0)::text`,
      impressions: sql<number>`coalesce(sum(${adMetricsDaily.impressions}), 0)::int`,
      clicks: sql<number>`coalesce(sum(${adMetricsDaily.clicks}), 0)::int`,
      conversions: sql<number>`coalesce(sum(${adMetricsDaily.conversions}), 0)::int`,
      hasAny: sql<number>`count(*)::int`,
    })
    .from(adMetricsDaily)
    .where(
      and(eq(adMetricsDaily.tenantId, tenantId), gte(adMetricsDaily.date, last30Iso)),
    );

  return {
    leadsThisMonth: leadsThis?.c ?? 0,
    leadsPriorMonth: leadsPrior?.c ?? 0,
    leadsLast7Days: leads7?.c ?? 0,
    leadsPrior7Days: leadsPrior7?.c ?? 0,
    wonThisMonth: wonThis?.c ?? 0,
    postsLast30Days: postsRow?.c ?? 0,
    qrScansLast30Days: qrRow?.c ?? 0,
    conversationsThisMonth: convThis?.c ?? 0,
    outboundLast30Days: outboundRow?.c ?? 0,
    ads30d:
      adsRow && adsRow.hasAny > 0
        ? {
            spendUsd: Number(adsRow.spend ?? 0),
            impressions: adsRow.impressions ?? 0,
            clicks: adsRow.clicks ?? 0,
            conversions: adsRow.conversions ?? 0,
          }
        : null,
  };
}

interface KpiState {
  hasLeadsTarget: boolean;
  leadsTarget: number;
  hasAnyKpi: boolean;
  totalKpis: number;
  onTrackKpis: number;
}

async function getKpiState(
  tenantId: string,
  tz: string,
  raw: RawCounts,
  now = new Date(),
): Promise<KpiState> {
  const tenantKpis = await db.select().from(kpis).where(eq(kpis.tenantId, tenantId));
  let leadsTarget = 0;
  let hasLeadsTarget = false;
  let onTrack = 0;
  const ms = tzMonthStart(now, tz).toISOString().slice(0, 10);

  const values = tenantKpis.length
    ? await db
        .select()
        .from(kpiValues)
        .where(and(eq(kpiValues.tenantId, tenantId), eq(kpiValues.periodStart, ms)))
    : [];

  for (const kpi of tenantKpis) {
    const target = Number(kpi.targetValue);
    const valueRow = values.find((v) => v.kpiId === kpi.id);
    let actual = valueRow ? Number(valueRow.actualValue) : 0;

    if (kpi.type === "leads_per_month") {
      hasLeadsTarget = true;
      leadsTarget = target;
      actual = raw.leadsThisMonth;
    }

    const pacing = pacingActualVsTarget(actual, target, tz, now);
    const pacingOk =
      kpi.direction === "lower_better"
        ? pacing.expected === 0 || actual <= pacing.expected
        : pacing.expected === 0 || actual >= pacing.expected;
    if (pacingOk) onTrack += 1;
  }

  return {
    hasLeadsTarget,
    leadsTarget,
    hasAnyKpi: tenantKpis.length > 0,
    totalKpis: tenantKpis.length,
    onTrackKpis: onTrack,
  };
}

interface Pacing {
  /** Expected progress by today (target × pct of month elapsed). */
  expected: number;
  pctOfMonth: number;
  delta: number;
}
function pacingActualVsTarget(
  actual: number,
  target: number,
  tz: string,
  now = new Date(),
): Pacing {
  const pct = Math.max(0.0001, tzDayOfMonth(now, tz) / tzDaysInMonth(now, tz));
  const expected = target * pct;
  return { expected, pctOfMonth: pct, delta: actual - expected };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function gauge(
  key: GaugeResult["key"],
  score: number | null,
  headline: string,
  fixNext: string,
  inputs: GaugeResult["inputs"],
): GaugeResult {
  return { key, score, status: statusFromScore(score), headline, fixNext, inputs };
}

/* ---------- Per-gauge scoring ---------- */

function scorePaid(raw: RawCounts): GaugeResult {
  // With ad-platform data wired in (Phase 8), score on real CTR + CPL + conversion rate.
  if (raw.ads30d) {
    const { spendUsd, impressions, clicks, conversions } = raw.ads30d;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpl = conversions > 0 ? spendUsd / conversions : null;
    const convRate = clicks > 0 ? conversions / clicks : 0;

    // CTR points: 0% → 0, 2% → 30, 4%+ → 30.
    const ctrPoints = clamp(Math.min(ctr / 0.04, 1) * 30);
    // CPL points: $0 → 30, $50 → 30, $200 → 15, $500+ → 0. Lower-is-better.
    let cplPoints = 0;
    if (cpl !== null) {
      if (cpl <= 50) cplPoints = 30;
      else if (cpl <= 200) cplPoints = 30 - ((cpl - 50) / 150) * 15;
      else if (cpl <= 500) cplPoints = 15 - ((cpl - 200) / 300) * 15;
      else cplPoints = 0;
    }
    // Conversion rate points: 0% → 0, 5% → 20, 10%+ → 20.
    const convPoints = clamp(Math.min(convRate / 0.1, 1) * 20);
    // Spend-presence points: paying $1+/day → 20.
    const spendPoints = spendUsd >= 30 ? 20 : Math.round((spendUsd / 30) * 20);

    const score = clamp(ctrPoints + cplPoints + convPoints + spendPoints);
    const cplLabel = cpl !== null ? `$${cpl.toFixed(2)}` : "no conv";

    return gauge(
      "paid",
      score,
      `30d: $${spendUsd.toFixed(0)} spend · ${conversions} conv · CPL ${cplLabel}.`,
      cpl === null
        ? "Conversion tracking isn't firing. Verify the Pixel/gtag is on your landing pages."
        : cpl > 200
          ? "CPL is high. Pause the worst campaign with list_ad_campaigns + pause_campaign."
          : "Healthy CPL. Try scaling the best ad set by 15%.",
      [
        { label: "Spend (30d)", value: `$${spendUsd.toFixed(0)}`, ok: spendUsd > 0 },
        { label: "CTR", value: `${(ctr * 100).toFixed(2)}%`, ok: ctr >= 0.02 },
        { label: "Cost per lead", value: cplLabel, ok: cpl !== null && cpl <= 200 },
        { label: "Conversion rate", value: `${(convRate * 100).toFixed(1)}%`, ok: convRate >= 0.05 },
      ],
    );
  }

  // No ad-platform connection yet: surface "needs setup" but still grade lead trend.
  const hasAnyHistory = raw.leadsPriorMonth + raw.leadsThisMonth > 0;
  if (!hasAnyHistory) {
    return gauge(
      "paid",
      null,
      "No paid-ad signal yet.",
      "Connect Google Ads and Meta in Settings to start scoring this gauge.",
      [
        { label: "Click rate", value: "—", ok: null },
        { label: "Cost per lead", value: "—", ok: null },
        { label: "Conversion rate", value: "—", ok: null },
      ],
    );
  }
  const growth =
    raw.leadsPriorMonth === 0 ? 1 : (raw.leadsThisMonth - raw.leadsPriorMonth) / raw.leadsPriorMonth;
  const score = clamp(60 + growth * 50);
  return gauge(
    "paid",
    score,
    `${raw.leadsThisMonth} leads this month vs ${raw.leadsPriorMonth} prior.`,
    "Connect Google and Meta to refine. Until then this score is a proxy from total lead volume.",
    [
      { label: "Lead volume MoM", value: `${raw.leadsThisMonth} / ${raw.leadsPriorMonth}`, ok: growth >= 0 },
      { label: "Click rate", value: "needs Google Ads", ok: null },
      { label: "Cost per lead", value: "needs Google Ads", ok: null },
    ],
  );
}

function scoreOrganic(raw: RawCounts, hasBrandVoice: boolean): GaugeResult {
  // 30 posts/30d ≥ 8 posts → 30 points
  // QR scans ≥ 20 → 20 points
  // Brand voice profile filled → 20 points
  // Inbound from non-ad sources → 30 points
  const postPoints = clamp((raw.postsLast30Days / 8) * 30);
  const qrPoints = clamp((raw.qrScansLast30Days / 20) * 20);
  const voicePoints = hasBrandVoice ? 20 : 0;
  const inboundPoints = clamp((raw.leadsLast7Days / 5) * 30);
  const score = clamp(postPoints + qrPoints + voicePoints + inboundPoints);

  return gauge(
    "organic",
    score,
    `${raw.postsLast30Days} posts and ${raw.qrScansLast30Days} QR scans in the last 30 days.`,
    raw.postsLast30Days < 4
      ? "Schedule 2–3 posts this week on /posts. Consistency moves this gauge."
      : !hasBrandVoice
        ? "Fill the brand-voice profile on /business so drafts compound."
        : "Refresh one service-area page or add a Google Business post this week.",
    [
      { label: "Posts (30d)", value: String(raw.postsLast30Days), ok: raw.postsLast30Days >= 4 },
      { label: "QR scans (30d)", value: String(raw.qrScansLast30Days), ok: raw.qrScansLast30Days >= 10 },
      { label: "Brand voice set", value: hasBrandVoice ? "yes" : "no", ok: hasBrandVoice },
      { label: "Leads (7d)", value: String(raw.leadsLast7Days), ok: raw.leadsLast7Days >= 3 },
    ],
  );
}

function scoreWebsite(raw: RawCounts): GaugeResult {
  // Trend in lead intake: last 7 vs prior 7
  const ratio =
    raw.leadsPrior7Days === 0 ? (raw.leadsLast7Days > 0 ? 1.5 : 0) : raw.leadsLast7Days / raw.leadsPrior7Days;
  // QR → lead engagement (rough)
  const scansToInquiry = raw.qrScansLast30Days > 0 ? raw.leadsLast7Days / raw.qrScansLast30Days : 0;

  const trendPoints = clamp(40 * Math.min(ratio, 2));
  const inquiryPoints = clamp(30 * Math.min(scansToInquiry * 4, 1));
  const baselinePoints = raw.conversationsThisMonth > 0 ? 30 : 0;
  const score = clamp(trendPoints + inquiryPoints + baselinePoints);

  return gauge(
    "website",
    raw.leadsLast7Days + raw.leadsPrior7Days + raw.qrScansLast30Days === 0 ? null : score,
    `Leads last 7 days: ${raw.leadsLast7Days}; prior 7: ${raw.leadsPrior7Days}.`,
    raw.leadsLast7Days < raw.leadsPrior7Days
      ? "Inbound is slipping. Add a sharper CTA on your homepage or run a 7-day promo."
      : "Site is converting. Add Click-to-Call to every page to push it further.",
    [
      { label: "Leads (7d)", value: String(raw.leadsLast7Days), ok: ratio >= 1 },
      { label: "vs prior 7d", value: String(raw.leadsPrior7Days), ok: null },
      { label: "Conv. this month", value: String(raw.conversationsThisMonth), ok: raw.conversationsThisMonth > 0 },
    ],
  );
}

function scoreKpis(raw: RawCounts, k: KpiState, tz: string, now = new Date()): GaugeResult {
  if (!k.hasAnyKpi) {
    return gauge(
      "kpis",
      null,
      "No KPIs set.",
      "Set at least one target on /kpis (start with leads-per-month).",
      [{ label: "Targets defined", value: "0", ok: false }],
    );
  }
  if (!k.hasLeadsTarget) {
    return gauge(
      "kpis",
      Math.round((k.onTrackKpis / k.totalKpis) * 100),
      `${k.onTrackKpis} of ${k.totalKpis} KPIs on track.`,
      "Add a leads-per-month target so Rosie can pace your inbound.",
      [{ label: "On-track KPIs", value: `${k.onTrackKpis} / ${k.totalKpis}`, ok: k.onTrackKpis === k.totalKpis }],
    );
  }

  const pacing = pacingActualVsTarget(raw.leadsThisMonth, k.leadsTarget, tz, now);
  // 100 when at/above expected, scaled down when below.
  const pct = pacing.expected === 0 ? 1 : raw.leadsThisMonth / pacing.expected;
  const score = clamp(Math.min(pct, 1.2) * 100);

  return gauge(
    "kpis",
    score,
    `${raw.leadsThisMonth} leads vs ${pacing.expected.toFixed(1)} expected by today.`,
    pacing.delta >= 0
      ? "On pace. Tighten your cost-per-lead next."
      : `Behind by ${Math.abs(Math.round(pacing.delta))} leads. Push one extra creative this week.`,
    [
      { label: "Leads MTD", value: String(raw.leadsThisMonth), ok: pacing.delta >= 0 },
      { label: "Pace target", value: pacing.expected.toFixed(1), ok: null },
      { label: "Monthly target", value: String(k.leadsTarget), ok: null },
      { label: "Other KPIs on track", value: `${k.onTrackKpis} / ${k.totalKpis}`, ok: k.onTrackKpis === k.totalKpis },
    ],
  );
}

export async function computeGaugeCluster(
  tenantId: string,
  now = new Date(),
): Promise<GaugeCluster> {
  const tz = await tenantTimezone(tenantId);
  const raw = await getRawCounts(tenantId, tz, now);
  const k = await getKpiState(tenantId, tz, raw, now);
  const profile = await db
    .select({ brandVoice: businessProfile.brandVoice })
    .from(businessProfile)
    .where(eq(businessProfile.tenantId, tenantId))
    .limit(1);
  const hasBrandVoice = Boolean(profile[0]?.brandVoice?.storytellingStrategy);

  const paid = scorePaid(raw);
  const organic = scoreOrganic(raw, hasBrandVoice);
  const website = scoreWebsite(raw);
  const kpisGauge = scoreKpis(raw, k, tz, now);

  const scored = [paid, organic, website, kpisGauge].filter(
    (g): g is GaugeResult & { score: number } => g.score !== null,
  );
  const composite =
    scored.length === 0
      ? null
      : Math.round(scored.reduce((sum, g) => sum + g.score, 0) / scored.length);

  let pacingHeadline: string | null = null;
  if (k.hasLeadsTarget) {
    const pacing = pacingActualVsTarget(raw.leadsThisMonth, k.leadsTarget, tz, now);
    const delta = Math.round(pacing.delta);
    if (delta >= 0) {
      pacingHeadline = `${raw.leadsThisMonth} leads vs a paced ${pacing.expected.toFixed(1)} — ahead by ${delta}.`;
    } else {
      pacingHeadline = `${raw.leadsThisMonth} leads vs a paced ${pacing.expected.toFixed(1)} — behind by ${Math.abs(delta)}.`;
    }
  }

  return {
    paid,
    organic,
    website,
    kpis: kpisGauge,
    composite,
    grade: gradeFromScore(composite),
    pacingHeadline,
  };
}
