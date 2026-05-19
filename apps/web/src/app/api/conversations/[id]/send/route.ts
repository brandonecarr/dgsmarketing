import { NextResponse } from "next/server";
import { z } from "zod";
import { db, conversations, messages, integrations, leads, sql } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { getProvider, type ProviderName } from "@rosie/messaging";
import { loadActiveSession } from "@/lib/active-tenant";
import { checkBudget, recordUsage } from "@/lib/usage";
import { decryptJson } from "@/lib/crypto";
import { isOptedOut } from "@/lib/compliance/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  body: z.string().min(1).max(1600),
  /** When true and the provider isn't connected, store-and-skip rather than 500. */
  dryRun: z.boolean().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const conv = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.tenantId, session.tenant.id)))
    .limit(1);
  if (!conv[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  // TCPA: refuse if the recipient has opted out of SMS for this tenant.
  if (
    conv[0].channel === "sms" &&
    conv[0].participantPhone &&
    (await isOptedOut(session.tenant.id, conv[0].participantPhone))
  ) {
    return NextResponse.json(
      {
        error:
          "This number has opted out of SMS. Sending would violate TCPA. Mark the lead Lost or reach out via another channel.",
      },
      { status: 451 },
    );
  }

  const verdict = await checkBudget({ tenantId: session.tenant.id, kind: "sms", units: 1 });
  if (!verdict.allowed) {
    return NextResponse.json({ error: verdict.reason }, { status: 402 });
  }

  const providerName = conv[0].provider as ProviderName;
  const integ = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, session.tenant.id),
        eq(integrations.provider, providerName),
      ),
    )
    .limit(1);

  const creds =
    decryptJson<{ apiKey?: string; fromId?: string; fromNumber?: string }>(integ[0]?.secrets) ??
    {};
  let externalId: string | null = null;
  let sentAt = new Date();

  if (!creds.apiKey && !parsed.data.dryRun) {
    return NextResponse.json(
      { error: `${providerName} is not connected. Add credentials in Settings.` },
      { status: 412 },
    );
  }

  if (creds.apiKey && conv[0].participantPhone) {
    try {
      const provider = getProvider(providerName);
      const sent = await provider.sendSms(
        { to: conv[0].participantPhone, body: parsed.data.body },
        { apiKey: creds.apiKey, fromId: creds.fromId, fromNumber: creds.fromNumber },
      );
      externalId = sent.externalId;
      sentAt = sent.sentAt;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "send failed" },
        { status: 502 },
      );
    }
  }

  const [msg] = await db
    .insert(messages)
    .values({
      tenantId: session.tenant.id,
      conversationId: conv[0].id,
      direction: "outbound",
      senderType: "operator",
      senderUserId: session.user.id,
      body: parsed.data.body,
      externalId,
      deliveredAt: sentAt,
    })
    .returning({ id: messages.id });

  await db
    .update(conversations)
    .set({
      lastMessageAt: sentAt,
      lastMessagePreview: parsed.data.body.slice(0, 140),
      unreadCount: 0,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conv[0].id));

  if (conv[0].leadId) {
    await db
      .update(leads)
      .set({
        lastMessageAt: sentAt,
        stage: sql`case when ${leads.stage} = 'new' then 'engaged'::lead_stage else ${leads.stage} end`,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, conv[0].leadId));
  }

  // Record the send for billing + governor. Inbound/dry-run still bills 0.
  await recordUsage({
    tenantId: session.tenant.id,
    kind: "sms_sent",
    units: 1,
    costUsd: externalId ? Number(process.env.ROSIE_SMS_UNIT_COST_USD ?? 0.01) : 0,
    source: "inbox_send",
    meta: { dryRun: !externalId, provider: providerName },
  });

  return NextResponse.json({ ok: true, messageId: msg?.id, externalId });
}
