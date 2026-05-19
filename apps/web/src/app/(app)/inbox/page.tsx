import { db, conversations, leads, messages, STAGE_ORDER } from "@rosie/db";
import { and, desc, eq, sql } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { newTimingContext, timed } from "@/lib/perf";
import { InboxView } from "./inbox-view";

interface PipelineCount {
  stage: (typeof STAGE_ORDER)[number];
  count: number;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const session = await loadActiveSession();
  const sp = await searchParams;
  const tc = newTimingContext({ path: "/inbox", tenantId: session.tenant.id });

  const convs = await timed("inbox.conversations", () =>
    db
      .select({
        id: conversations.id,
        participantPhone: conversations.participantPhone,
        participantName: conversations.participantName,
        lastMessageAt: conversations.lastMessageAt,
        lastMessagePreview: conversations.lastMessagePreview,
        unreadCount: conversations.unreadCount,
        provider: conversations.provider,
        leadId: conversations.leadId,
        stage: leads.stage,
        score: leads.score,
      })
      .from(conversations)
      .leftJoin(leads, eq(leads.id, conversations.leadId))
      .where(eq(conversations.tenantId, session.tenant.id))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(100),
    tc,
  );

  const counts = await timed("inbox.stage_counts", () =>
    db
      .select({ stage: leads.stage, count: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.tenantId, session.tenant.id))
      .groupBy(leads.stage),
    tc,
  );

  const stageCounts: PipelineCount[] = STAGE_ORDER.map((s) => ({
    stage: s,
    count: counts.find((c) => c.stage === s)?.count ?? 0,
  }));

  const totals = await timed("inbox.totals", () =>
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where stage not in ('won','lost'))::int`,
        won: sql<number>`count(*) filter (where stage = 'won')::int`,
      })
      .from(leads)
      .where(eq(leads.tenantId, session.tenant.id)),
    tc,
  );

  const totalRow = totals[0] ?? { total: 0, active: 0, won: 0 };
  const closeRate = totalRow.total > 0 ? Math.round((totalRow.won / totalRow.total) * 100) : 0;

  // Preload active thread messages.
  let activeMessages: Array<{
    id: string;
    direction: "inbound" | "outbound";
    body: string;
    createdAt: Date;
    providerMetadata: Record<string, unknown> | null;
    language: string | null;
    translatedBody: string | null;
    translatedTo: string | null;
  }> = [];
  let activeConv: (typeof convs)[number] | null = null;
  const threadId = sp.thread ?? convs[0]?.id;
  if (threadId) {
    activeConv = convs.find((c) => c.id === threadId) ?? null;
    if (activeConv) {
      const rows = await timed("inbox.thread_messages", () =>
        db
          .select({
            id: messages.id,
            direction: messages.direction,
            body: messages.body,
            createdAt: messages.createdAt,
            providerMetadata: messages.providerMetadata,
            language: messages.language,
            translatedBody: messages.translatedBody,
            translatedTo: messages.translatedTo,
          })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, activeConv!.id),
              eq(messages.tenantId, session.tenant.id),
            ),
          )
          .orderBy(messages.createdAt),
        tc,
      );
      activeMessages = rows;
    }
  }

  return (
    <InboxView
      tenantId={session.tenant.id}
      userId={session.user.id}
      userName={
        (session.user.user_metadata?.full_name as string | undefined) ??
        session.user.email ??
        "Operator"
      }
      conversations={convs.map((c) => ({
        ...c,
        lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
      }))}
      stageCounts={stageCounts}
      stats={{ ...totalRow, closeRate }}
      activeConversationId={activeConv?.id ?? null}
      activeMessages={activeMessages.map((m) => ({
        id: m.id,
        direction: m.direction,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        recordingUrl:
          typeof (m.providerMetadata as { recordingUrl?: unknown } | null)?.recordingUrl === "string"
            ? ((m.providerMetadata as { recordingUrl: string }).recordingUrl)
            : null,
        language: m.language,
        translatedBody: m.translatedBody,
        translatedTo: m.translatedTo,
      }))}
      tenantLocale={session.tenant.locale ?? "en-US"}
    />
  );
}
