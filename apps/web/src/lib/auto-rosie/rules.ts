import { and, desc, eq, gte, isNull, lt, or, sql } from "@rosie/db";
import { db, leads, messages, posts, actions } from "@rosie/db";
import type { Rule, RuleResult } from "./types";

const HOURS = (n: number) => n * 60 * 60 * 1000;

async function alreadyEmitted(
  tenantId: string,
  source: import("@rosie/db").Action["source"],
  relatedEntityId: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: actions.id })
    .from(actions)
    .where(
      and(
        eq(actions.tenantId, tenantId),
        eq(actions.source, source),
        eq(actions.relatedEntityId, relatedEntityId),
        or(eq(actions.status, "open"), eq(actions.status, "in_progress"), eq(actions.status, "snoozed")),
      ),
    )
    .limit(1);
  return existing.length > 0;
}

/**
 * Rule 1 — when a lead has been Won for >2h, ask for a review.
 * The action's metadata.draftMessage carries a ready-to-send SMS.
 */
export const reviewAfterWon: Rule = {
  name: "review_after_won",
  async run({ tenantId, now }) {
    const t0 = Date.now();
    const twoHoursAgo = new Date(now.getTime() - HOURS(2));
    const recentWon = await db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        wonAt: leads.wonAt,
      })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          eq(leads.stage, "won"),
          lt(leads.wonAt, twoHoursAgo),
          gte(leads.wonAt, new Date(now.getTime() - HOURS(72))),
        ),
      )
      .limit(50);

    const emissions: RuleResult["emissions"] = [];
    for (const lead of recentWon) {
      if (await alreadyEmitted(tenantId, "rule_review_after_won", lead.id)) continue;
      const display = lead.name ?? lead.phone ?? "your new customer";
      const draftMessage = `Hi${lead.name ? ` ${lead.name.split(" ")[0]}` : ""}! Thanks again for choosing us. If you have a sec, a quick Google review goes a long way — here's the link: {{REVIEW_URL}}. Appreciate you!`;
      emissions.push({
        action: {
          title: `Ask ${display} for a Google review`,
          body: `We marked them Won ${lead.wonAt ? new Date(lead.wonAt).toLocaleString() : "recently"}. Reviews are the single highest-leverage organic move you can make right now. Rosie prepared the text below — paste your Google review link into the placeholder and send.`,
          priority: 3,
          source: "rule_review_after_won",
          relatedEntityType: "lead",
          relatedEntityId: lead.id,
          metadata: {
            leadId: lead.id,
            phone: lead.phone,
            draftMessage,
          },
        },
      });
    }

    return {
      rule: "review_after_won",
      emissions,
      inputs: { recentWonCount: recentWon.length },
      durationMs: Date.now() - t0,
    };
  },
};

/**
 * Rule 2 — when a Quoted lead has had no outbound message in 24h,
 * surface a follow-up suggestion.
 */
export const followupAfterQuoted24h: Rule = {
  name: "followup_after_quoted_24h",
  async run({ tenantId, now }) {
    const t0 = Date.now();
    const oneDayAgo = new Date(now.getTime() - HOURS(24));

    const quoted = await db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        lastMessageAt: leads.lastMessageAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          eq(leads.stage, "quoted"),
          or(isNull(leads.lastMessageAt), lt(leads.lastMessageAt, oneDayAgo)),
        ),
      )
      .limit(50);

    const emissions: RuleResult["emissions"] = [];
    for (const lead of quoted) {
      if (await alreadyEmitted(tenantId, "rule_followup_after_quoted", lead.id)) continue;
      const draftMessage = `Hi${lead.name ? ` ${lead.name.split(" ")[0]}` : ""}! Just circling back on the quote — any questions I can answer? Happy to get you on the schedule whenever you're ready.`;
      const display = lead.name ?? lead.phone ?? "this lead";
      emissions.push({
        action: {
          title: `Follow up with ${display} — quoted 24h+ ago`,
          body: `They've been sitting in Quoted with no outbound from us in the last 24h. A short, no-pressure nudge converts a healthy chunk of these.`,
          priority: 4,
          source: "rule_followup_after_quoted",
          relatedEntityType: "lead",
          relatedEntityId: lead.id,
          metadata: { leadId: lead.id, phone: lead.phone, draftMessage },
        },
      });
    }

    return {
      rule: "followup_after_quoted_24h",
      emissions,
      inputs: { quotedCount: quoted.length },
      durationMs: Date.now() - t0,
    };
  },
};

/**
 * Rule 3 — pause-campaign-with-zero-conv.
 * No ad-platform integration yet, so we proxy: if outbound replies are happening
 * but no leads converted, surface the pattern.
 */
export const pauseZeroConv: Rule = {
  name: "pause_zero_conv",
  async run({ tenantId, now }) {
    const t0 = Date.now();
    const sevenDaysAgo = new Date(now.getTime() - HOURS(168));

    const [stats] = await db
      .select({
        outbound: sql<number>`count(*) filter (where direction = 'outbound')::int`,
        inbound: sql<number>`count(*) filter (where direction = 'inbound')::int`,
      })
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), gte(messages.createdAt, sevenDaysAgo)));

    const [wonRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), eq(leads.stage, "won"), gte(leads.wonAt, sevenDaysAgo)));

    const outbound = stats?.outbound ?? 0;
    const inbound = stats?.inbound ?? 0;
    const won = wonRow?.c ?? 0;

    const emissions: RuleResult["emissions"] = [];
    if (outbound >= 10 && won === 0) {
      emissions.push({
        action: {
          title: "Outreach activity is up but no closes — review the funnel",
          body: `In the last 7 days you sent ${outbound} outbound messages and received ${inbound} inbound replies, but zero deals closed. Look for a stage where leads are dropping off (commonly Quoted → Booked).`,
          priority: 4,
          source: "rule_pause_zero_conv",
          metadata: { outbound, inbound, won, periodDays: 7 },
        },
      });
    }

    return {
      rule: "pause_zero_conv",
      emissions,
      inputs: { outbound, inbound, won, periodDays: 7 },
      durationMs: Date.now() - t0,
    };
  },
};

/** Rule 4 — gentle nudge when the org hasn't posted in two weeks. */
export const noRecentPost: Rule = {
  name: "no_recent_post",
  async run({ tenantId, now }) {
    const t0 = Date.now();
    const fourteenDaysAgo = new Date(now.getTime() - HOURS(14 * 24));

    const [latest] = await db
      .select({ createdAt: posts.createdAt })
      .from(posts)
      .where(eq(posts.tenantId, tenantId))
      .orderBy(desc(posts.createdAt))
      .limit(1);

    const lastAt = latest?.createdAt ?? null;
    const emissions: RuleResult["emissions"] = [];
    if (!lastAt || lastAt < fourteenDaysAgo) {
      // Dedupe: don't emit if there's already an open one from this rule.
      const dup = await db
        .select({ id: actions.id })
        .from(actions)
        .where(
          and(
            eq(actions.tenantId, tenantId),
            eq(actions.source, "rule_no_recent_post"),
            eq(actions.status, "open"),
          ),
        )
        .limit(1);
      if (dup.length === 0) {
        emissions.push({
          action: {
            title: lastAt
              ? `No new posts in ${Math.round((now.getTime() - lastAt.getTime()) / (24 * 60 * 60 * 1000))} days`
              : "No posts yet — ship one this week",
            body: "Organic momentum compounds. Open /posts → Calendar and let Rosie plan the next two weeks. You can draft and schedule the whole calendar in under five minutes.",
            priority: 5,
            source: "rule_no_recent_post",
            metadata: { lastPostAt: lastAt ? lastAt.toISOString() : null },
          },
        });
      }
    }

    return {
      rule: "no_recent_post",
      emissions,
      inputs: { lastPostAt: lastAt ? lastAt.toISOString() : null },
      durationMs: Date.now() - t0,
    };
  },
};

export const ALL_RULES: Rule[] = [
  reviewAfterWon,
  followupAfterQuoted24h,
  pauseZeroConv,
  noRecentPost,
];
