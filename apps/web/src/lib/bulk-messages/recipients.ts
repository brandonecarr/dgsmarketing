import { db, leads, messages, conversations, type BulkFilter, STAGE_ORDER } from "@rosie/db";
import { and, desc, eq, gte, isNotNull, sql } from "@rosie/db";

/**
 * Materialize the list of (leadId, phone) pairs that match a saved bulk-message
 * filter. Always restricts to leads with a phone number.
 */
export async function previewBulkRecipients(
  tenantId: string,
  filter: BulkFilter | null | undefined,
  limit = 500,
): Promise<Array<{ leadId: string; name: string | null; phone: string }>> {
  let where = and(eq(leads.tenantId, tenantId), isNotNull(leads.phone));

  if (filter?.stages?.length) {
    const valid = filter.stages.filter((s): s is (typeof STAGE_ORDER)[number] =>
      (STAGE_ORDER as readonly string[]).includes(s),
    );
    if (valid.length > 0) {
      where = and(where, sql`${leads.stage} = ANY(${valid})`);
    }
  }
  if (filter?.source?.length) {
    where = and(where, sql`${leads.source} = ANY(${filter.source})`);
  }
  if (filter?.createdWithinDays) {
    const since = new Date(Date.now() - filter.createdWithinDays * 24 * 60 * 60 * 1000);
    where = and(where, gte(leads.createdAt, since));
  }
  if (filter?.commercial === "only") {
    where = and(where, eq(leads.isCommercial, 1));
  } else if (filter?.commercial === "exclude") {
    where = and(where, eq(leads.isCommercial, 0));
  }
  // "any" — no extra constraint.

  const allRows = await db
    .select({ leadId: leads.id, name: leads.name, phone: leads.phone })
    .from(leads)
    .where(where)
    .orderBy(desc(leads.createdAt))
    .limit(limit);

  let rows: Array<{ leadId: string; name: string | null; phone: string }> = [];
  for (const r of allRows) {
    if (r.phone) rows.push({ leadId: r.leadId, name: r.name, phone: r.phone });
  }

  // Optional "no outbound for N days" post-filter (cheaper than joining at query time).
  if (filter?.noOutboundForDays) {
    const cutoff = new Date(Date.now() - filter.noOutboundForDays * 24 * 60 * 60 * 1000);
    const recent = await db
      .select({ leadId: conversations.leadId, lastOutbound: sql<Date>`max(${messages.createdAt})` })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(
        and(
          eq(messages.tenantId, tenantId),
          eq(messages.direction, "outbound"),
          gte(messages.createdAt, cutoff),
        ),
      )
      .groupBy(conversations.leadId);
    const recentSet = new Set(recent.map((r) => r.leadId).filter(Boolean) as string[]);
    rows = rows.filter((r) => !recentSet.has(r.leadId));
  }
  return rows;
}
