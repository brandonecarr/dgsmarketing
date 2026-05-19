import { NextResponse } from "next/server";
import { db, leads, conversations, messages, posts } from "@rosie/db";
import { and, desc, eq, sql } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

export const runtime = "nodejs";

/**
 * Global tenant search. Hits 4 indexed sources via pg_trgm + tsvector:
 *   - leads.name / phone / email   (trigram)
 *   - conversations.last_message_preview (trigram)
 *   - messages.body (full-text)
 *   - posts.body (full-text)
 *
 * Returns up to 10 results per source, ranked by recency. Sub-200ms on
 * typical SMB datasets once Phase 11's GIN indexes are in place.
 */
export async function GET(req: Request) {
  const session = await loadActiveSession();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: { leads: [], threads: [], posts: [] } });

  const trgm = `%${q.replace(/[\\%_]/g, " ")}%`;
  const websearch = q;

  const [foundLeads, foundConvs, foundPosts] = await Promise.all([
    db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        email: leads.email,
        stage: leads.stage,
      })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, session.tenant.id),
          sql`(${leads.name} ilike ${trgm} or ${leads.phone} ilike ${trgm} or ${leads.email} ilike ${trgm})`,
        ),
      )
      .orderBy(desc(leads.createdAt))
      .limit(10),

    db
      .select({
        id: conversations.id,
        leadId: conversations.leadId,
        participantName: conversations.participantName,
        participantPhone: conversations.participantPhone,
        preview: conversations.lastMessagePreview,
        lastAt: conversations.lastMessageAt,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, session.tenant.id),
          sql`${conversations.lastMessagePreview} ilike ${trgm}`,
        ),
      )
      .orderBy(desc(conversations.lastMessageAt))
      .limit(10),

    db
      .select({
        id: posts.id,
        platform: posts.platform,
        status: posts.status,
        body: posts.body,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(
        and(
          eq(posts.tenantId, session.tenant.id),
          sql`to_tsvector('english', ${posts.body}) @@ websearch_to_tsquery('english', ${websearch})`,
        ),
      )
      .orderBy(desc(posts.createdAt))
      .limit(10),
  ]);

  // Free-text message search uses ts_headline so the UI can show the matched fragment.
  const foundMessages = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      direction: messages.direction,
      createdAt: messages.createdAt,
      snippet: sql<string>`ts_headline('english', ${messages.body}, websearch_to_tsquery('english', ${websearch}), 'MaxFragments=1, ShortWord=2')`,
    })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, session.tenant.id),
        sql`to_tsvector('english', ${messages.body}) @@ websearch_to_tsquery('english', ${websearch})`,
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(10);

  return NextResponse.json({
    results: {
      leads: foundLeads,
      threads: foundConvs.map((c) => ({
        ...c,
        lastAt: c.lastAt ? c.lastAt.toISOString() : null,
      })),
      messages: foundMessages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
      posts: foundPosts.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    },
  });
}
