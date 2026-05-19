import { NextResponse } from "next/server";
import { db, leads, conversations, messages } from "@rosie/db";
import { and, eq, sql } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

interface SeedLead {
  name: string;
  phone: string;
  email: string;
  stage: "new" | "engaged" | "quoted" | "qualified" | "booked" | "won" | "lost";
  source: "fb_lead_form" | "web_form" | "make_webhook" | "manual";
  body: string;
  outboundReply?: string;
  ageMinutes: number;
}

const SAMPLE_LEADS: SeedLead[] = [
  {
    name: "Avery Rodriguez",
    phone: "+15205550101",
    email: "avery.r@example.com",
    stage: "new",
    source: "web_form",
    body: "Hey, can you guys come out tomorrow? My yard's a disaster after the weekend party.",
    ageMinutes: 8,
  },
  {
    name: "Bao Nguyen",
    phone: "+15205550102",
    email: "bao@example.com",
    stage: "engaged",
    source: "fb_lead_form",
    body: "Hi! Saw the FB ad. How much for weekly service on a half-acre lot?",
    outboundReply:
      "Hi Bao! We do weekly for half-acres starting at $89/visit. Want me to send a quote?",
    ageMinutes: 35,
  },
  {
    name: "Casey Park",
    phone: "+15205550103",
    email: "casey.park@example.com",
    stage: "quoted",
    source: "web_form",
    body: "Yes please send the quote when you can.",
    outboundReply:
      "Here's your quote: $112 per visit, 1× weekly. Reply YES to book the first visit on Tuesday.",
    ageMinutes: 120,
  },
  {
    name: "Devon Patel",
    phone: "+15205550104",
    email: "devon.p@example.com",
    stage: "booked",
    source: "fb_lead_form",
    body: "YES book me",
    outboundReply: "You're on the books for Thursday 9am. We'll text you when we're on the way.",
    ageMinutes: 240,
  },
  {
    name: "Emma Chen",
    phone: "+15205550105",
    email: "emma@example.com",
    stage: "won",
    source: "make_webhook",
    body: "Just paid the invoice — looking forward to next week!",
    outboundReply: "Thanks Emma! See you Thursday.",
    ageMinutes: 60 * 24,
  },
  {
    name: "Felix Brown",
    phone: "+15205550106",
    email: "felix@example.com",
    stage: "lost",
    source: "web_form",
    body: "Thanks but I went with someone cheaper.",
    outboundReply: "Totally understand — keep us in mind if you change your mind!",
    ageMinutes: 60 * 36,
  },
  {
    name: "Gia Russo",
    phone: "+15205550107",
    email: "gia@example.com",
    stage: "qualified",
    source: "fb_lead_form",
    body: "Two dogs, big yard. What's your most affordable plan?",
    outboundReply:
      "Bi-weekly works great for two dogs — $69/visit. Want me to put you on the schedule?",
    ageMinutes: 17,
  },
];

/**
 * Seed a fresh tenant with a handful of pretend leads + messages so the
 * inbox, gauges, and KPI views have something to render. Idempotent: if any
 * of these phone numbers already exist for the tenant we skip — running it
 * twice in a row won't duplicate data.
 */
export async function POST(req: Request) {
  const session = await loadActiveSession();
  const now = Date.now();
  let created = 0;
  let skipped = 0;

  for (const sample of SAMPLE_LEADS) {
    const [existing] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.tenantId, session.tenant.id), eq(leads.phone, sample.phone)))
      .limit(1);
    if (existing) {
      skipped++;
      continue;
    }

    const firstContact = new Date(now - sample.ageMinutes * 60_000);
    const [lead] = await db
      .insert(leads)
      .values({
        tenantId: session.tenant.id,
        name: sample.name,
        phone: sample.phone,
        email: sample.email,
        source: sample.source,
        stage: sample.stage,
        firstContactAt: firstContact,
        lastMessageAt: firstContact,
        attribution: { utmSource: "sample-data" },
        metadata: { seeded: true },
      })
      .returning({ id: leads.id });
    if (!lead?.id) continue;

    const [conv] = await db
      .insert(conversations)
      .values({
        tenantId: session.tenant.id,
        leadId: lead.id,
        provider: "manual",
        channel: "sms",
        participantPhone: sample.phone,
        participantName: sample.name,
        lastMessageAt: firstContact,
        lastMessagePreview: sample.body.slice(0, 120),
      })
      .returning({ id: conversations.id });
    if (!conv?.id) continue;

    await db.insert(messages).values({
      tenantId: session.tenant.id,
      conversationId: conv.id,
      direction: "inbound",
      senderType: "lead",
      body: sample.body,
      externalId: `sample:${lead.id}:in`,
      deliveredAt: firstContact,
    });

    if (sample.outboundReply) {
      const replyAt = new Date(firstContact.getTime() + 90_000);
      await db.insert(messages).values({
        tenantId: session.tenant.id,
        conversationId: conv.id,
        direction: "outbound",
        senderType: "rosie",
        body: sample.outboundReply,
        externalId: `sample:${lead.id}:out`,
        deliveredAt: replyAt,
      });
      await db
        .update(conversations)
        .set({ lastMessageAt: replyAt, lastMessagePreview: sample.outboundReply.slice(0, 120) })
        .where(eq(conversations.id, conv.id));
    }
    created++;
  }

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "tenant.update",
    entityType: "tenant",
    entityId: session.tenant.id,
    summary: `Seeded sample data (${created} new, ${skipped} skipped)`,
    payload: { created, skipped },
    headers: req.headers,
  });

  return NextResponse.json({ ok: true, created, skipped, total: SAMPLE_LEADS.length });
}

/**
 * Companion DELETE — clears anything we tagged with metadata.seeded so the
 * operator can flip back to a clean slate before going live. Filters
 * defensively so a future bug can't widen this to real leads.
 */
export async function DELETE(req: Request) {
  const session = await loadActiveSession();
  const removed = await db
    .delete(leads)
    .where(
      and(
        eq(leads.tenantId, session.tenant.id),
        sql`(${leads.metadata} ->> 'seeded')::boolean = true`,
      ),
    )
    .returning({ id: leads.id });

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "tenant.update",
    entityType: "tenant",
    entityId: session.tenant.id,
    summary: `Cleared ${removed.length} seeded sample leads`,
    headers: req.headers,
  });

  return NextResponse.json({ ok: true, removed: removed.length });
}
