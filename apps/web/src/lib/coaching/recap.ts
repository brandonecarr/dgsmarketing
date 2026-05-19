import {
  db,
  leads,
  conversations,
  messages,
  posts,
  actions,
  tenants,
  STAGE_ORDER,
} from "@rosie/db";
import { and, eq, gte, lt, sql } from "@rosie/db";

export interface WeeklyRecap {
  tenantId: string;
  tenantName: string;
  weekStart: Date;
  weekEnd: Date;
  newLeads: number;
  wonLeads: number;
  lostLeads: number;
  inbound: number;
  outbound: number;
  postsPublished: number;
  openActions: number;
  closeRatePct: number;
  topStage: { stage: string; count: number } | null;
  prevWeek: {
    newLeads: number;
    wonLeads: number;
  };
}

/**
 * Aggregates a week's worth of activity for one tenant. Always returns the
 * Mon–Sun window ending immediately before `referenceDate`. The previous
 * week's headline counts are included so the email can render a delta.
 */
export async function buildWeeklyRecap(
  tenant: { id: string; name: string },
  referenceDate = new Date(),
): Promise<WeeklyRecap> {
  const weekEnd = startOfDayUtc(referenceDate);
  const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    leadCounts,
    msgCounts,
    publishedCount,
    openActionsRow,
    prevLeadCounts,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        won: sql<number>`count(*) filter (where stage = 'won')::int`,
        lost: sql<number>`count(*) filter (where stage = 'lost')::int`,
      })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenant.id),
          gte(leads.createdAt, weekStart),
          lt(leads.createdAt, weekEnd),
        ),
      ),
    db
      .select({
        inbound: sql<number>`count(*) filter (where direction = 'inbound')::int`,
        outbound: sql<number>`count(*) filter (where direction = 'outbound')::int`,
      })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenant.id),
          gte(messages.createdAt, weekStart),
          lt(messages.createdAt, weekEnd),
        ),
      ),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(posts)
      .where(
        and(
          eq(posts.tenantId, tenant.id),
          gte(posts.publishedAt, weekStart),
          lt(posts.publishedAt, weekEnd),
        ),
      ),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(actions)
      .where(and(eq(actions.tenantId, tenant.id), eq(actions.status, "open"))),
    db
      .select({
        total: sql<number>`count(*)::int`,
        won: sql<number>`count(*) filter (where stage = 'won')::int`,
      })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenant.id),
          gte(leads.createdAt, prevWeekStart),
          lt(leads.createdAt, weekStart),
        ),
      ),
  ]);

  // Top stage among NEW leads this week — gives the operator a sense of
  // funnel shape.
  const stageRows = await db
    .select({ stage: leads.stage, c: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        eq(leads.tenantId, tenant.id),
        gte(leads.createdAt, weekStart),
        lt(leads.createdAt, weekEnd),
      ),
    )
    .groupBy(leads.stage);

  const topStage =
    stageRows.sort((a, b) => b.c - a.c)[0] ?? null;

  const newLeads = leadCounts[0]?.total ?? 0;
  const wonLeads = leadCounts[0]?.won ?? 0;
  const closeRatePct = newLeads > 0 ? Math.round((wonLeads / newLeads) * 100) : 0;

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    weekStart,
    weekEnd,
    newLeads,
    wonLeads,
    lostLeads: leadCounts[0]?.lost ?? 0,
    inbound: msgCounts[0]?.inbound ?? 0,
    outbound: msgCounts[0]?.outbound ?? 0,
    postsPublished: publishedCount[0]?.c ?? 0,
    openActions: openActionsRow[0]?.c ?? 0,
    closeRatePct,
    topStage: topStage ? { stage: String(topStage.stage), count: topStage.c } : null,
    prevWeek: {
      newLeads: prevLeadCounts[0]?.total ?? 0,
      wonLeads: prevLeadCounts[0]?.won ?? 0,
    },
  };
}

function startOfDayUtc(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/**
 * Render the recap as Resend-friendly HTML. Kept inline so we don't pull in a
 * full templating engine just for one weekly email.
 */
export function renderRecapEmail(recap: WeeklyRecap, baseUrl: string): { subject: string; html: string } {
  const delta = (cur: number, prev: number): string => {
    if (prev === 0 && cur === 0) return "—";
    if (prev === 0) return `+${cur}`;
    const diff = cur - prev;
    const pct = Math.round((diff / prev) * 100);
    const sign = diff > 0 ? "+" : "";
    return `${sign}${diff} (${sign}${pct}%)`;
  };

  const subject = `Rosie weekly recap · ${recap.tenantName} · ${recap.newLeads} new lead${
    recap.newLeads === 1 ? "" : "s"
  }`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0b0b14;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5b21b6;">Weekly recap</div>
    <h1 style="margin:6px 0 4px;font-size:24px;font-weight:800;">${escapeHtml(recap.tenantName)}</h1>
    <div style="font-size:13px;color:#52525b;">${formatRange(recap.weekStart, recap.weekEnd)}</div>

    <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:8px;margin:24px 0;">
      <tr>
        ${statBlock("New leads", recap.newLeads, delta(recap.newLeads, recap.prevWeek.newLeads))}
        ${statBlock("Won", recap.wonLeads, delta(recap.wonLeads, recap.prevWeek.wonLeads))}
        ${statBlock("Close rate", `${recap.closeRatePct}%`, recap.newLeads === 0 ? "—" : "")}
      </tr>
      <tr>
        ${statBlock("Inbound msgs", recap.inbound, "")}
        ${statBlock("Outbound msgs", recap.outbound, "")}
        ${statBlock("Posts published", recap.postsPublished, "")}
      </tr>
    </table>

    ${recap.topStage
      ? `<div style="background:#fff;border:1px solid #e7e7ee;border-radius:12px;padding:14px 18px;margin-bottom:18px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#52525b;">Funnel snapshot</div>
          <div style="margin-top:4px;font-size:14px;">Most leads landed in <strong>${escapeHtml(recap.topStage.stage)}</strong> (${recap.topStage.count})</div>
        </div>`
      : ""}

    ${recap.openActions > 0
      ? `<div style="background:#fff;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:12px;padding:14px 18px;margin-bottom:18px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#92400e;">Needs review</div>
          <div style="margin-top:4px;font-size:14px;">Rosie has <strong>${recap.openActions}</strong> suggestion${recap.openActions === 1 ? "" : "s"} waiting in your queue.</div>
          <a href="${baseUrl}/review" style="display:inline-block;margin-top:10px;background:#5b21b6;color:#fff;padding:9px 14px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;">Review now</a>
        </div>`
      : `<div style="background:#fff;border:1px solid #e7e7ee;border-radius:12px;padding:14px 18px;margin-bottom:18px;font-size:14px;color:#52525b;">
          No suggestions pending — you're caught up.
        </div>`}

    <div style="font-size:11px;color:#a1a1aa;text-align:center;margin-top:28px;">
      Sent by Rosie · <a href="${baseUrl}/overview" style="color:#a1a1aa;text-decoration:underline;">Open dashboard</a>
    </div>
  </div>
</body></html>`;
  return { subject, html };
}

function statBlock(label: string, value: string | number, delta: string): string {
  return `<td style="background:#fff;border:1px solid #e7e7ee;border-radius:12px;padding:12px 14px;width:33%;vertical-align:top;">
    <div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#52525b;">${escapeHtml(label)}</div>
    <div style="margin-top:4px;font-size:22px;font-weight:800;">${escapeHtml(String(value))}</div>
    ${delta ? `<div style="font-size:11px;color:${delta.startsWith("+") || delta === "—" ? "#16a34a" : "#dc2626"};">${escapeHtml(delta)}</div>` : ""}
  </td>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatRange(a: Date, b: Date): string {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${fmt.format(a)} – ${fmt.format(new Date(b.getTime() - 1))}`;
}

void STAGE_ORDER;
void tenants;
void conversations;
