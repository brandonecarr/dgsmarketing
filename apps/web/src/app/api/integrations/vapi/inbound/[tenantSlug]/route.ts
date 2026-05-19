import { NextResponse } from "next/server";
import { db, calls, integrations, conversations, messages, leads } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { parseVapiEvent } from "@/lib/vapi/client";
import { resolveTenantBySlug } from "@/lib/conversations";
import { verifyTenantWebhook } from "@/lib/webhook-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "unknown tenant" }, { status: 404 });

  const [integ] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.tenantId, tenant.id), eq(integrations.provider, "vapi")))
    .limit(1);

  const rawBody = await req.text();
  if (integ?.webhookSecret) {
    const hmac = verifyTenantWebhook(rawBody, req.headers, integ.webhookSecret, "bare-hex");
    const bearer =
      req.headers.get("x-vapi-secret") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const bearerOk = bearer === integ.webhookSecret;
    if (!hmac.ok && !bearerOk) {
      return NextResponse.json(
        { error: hmac.reason ?? "unauthorized" },
        { status: 401 },
      );
    }
  }

  const body = (() => {
    try {
      return rawBody ? JSON.parse(rawBody) : null;
    } catch {
      return null;
    }
  })();
  const summary = parseVapiEvent(body);
  if (!summary) return NextResponse.json({ ok: true, ignored: true });

  // Upsert the call row by externalId.
  const [existing] = await db
    .select({ id: calls.id, conversationId: calls.conversationId, leadId: calls.leadId })
    .from(calls)
    .where(and(eq(calls.tenantId, tenant.id), eq(calls.externalId, summary.externalId)))
    .limit(1);

  let conversationId = existing?.conversationId ?? null;
  let leadId = existing?.leadId ?? null;

  // For inbound calls, find or create a conversation + lead by participant phone.
  if (!conversationId && summary.direction === "inbound" && summary.fromNumber) {
    const [conv] = await db
      .select({ id: conversations.id, leadId: conversations.leadId })
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, tenant.id),
          eq(conversations.participantPhone, summary.fromNumber),
        ),
      )
      .limit(1);
    if (conv) {
      conversationId = conv.id;
      leadId = conv.leadId;
    } else {
      const [newLead] = await db
        .insert(leads)
        .values({
          tenantId: tenant.id,
          phone: summary.fromNumber,
          source: "manual",
          stage: "new",
          firstContactAt: summary.startedAt ?? new Date(),
          lastMessageAt: summary.startedAt ?? new Date(),
        })
        .returning({ id: leads.id });
      leadId = newLead?.id ?? null;
      const [newConv] = await db
        .insert(conversations)
        .values({
          tenantId: tenant.id,
          leadId,
          channel: "call",
          provider: "manual",
          participantPhone: summary.fromNumber,
          lastMessageAt: summary.startedAt ?? new Date(),
          lastMessagePreview: summary.summary?.slice(0, 140) ?? "Inbound call",
          unreadCount: 1,
        })
        .returning({ id: conversations.id });
      conversationId = newConv?.id ?? null;
    }
  }

  if (existing) {
    await db
      .update(calls)
      .set({
        status: summary.status,
        transcript: summary.transcript,
        summary: summary.summary,
        durationSec: summary.durationSec?.toString(),
        recordingUrl: summary.recordingUrl,
        endedAt: summary.endedAt,
        startedAt: summary.startedAt ?? new Date(),
        raw: body,
        updatedAt: new Date(),
      })
      .where(eq(calls.id, existing.id));
  } else {
    await db.insert(calls).values({
      tenantId: tenant.id,
      leadId,
      conversationId,
      externalId: summary.externalId,
      provider: "vapi",
      direction: summary.direction,
      fromNumber: summary.fromNumber,
      toNumber: summary.toNumber,
      status: summary.status,
      transcript: summary.transcript,
      summary: summary.summary,
      durationSec: summary.durationSec?.toString(),
      recordingUrl: summary.recordingUrl,
      startedAt: summary.startedAt,
      endedAt: summary.endedAt,
      raw: body,
    });
  }

  // Drop transcript snippets into the conversation so they render in the inbox.
  if (conversationId && summary.transcript) {
    await db.insert(messages).values({
      tenantId: tenant.id,
      conversationId,
      direction: summary.direction === "inbound" ? "inbound" : "outbound",
      senderType: summary.direction === "inbound" ? "lead" : "rosie",
      body: `📞 Call ${summary.status}${
        summary.durationSec ? ` (${summary.durationSec}s)` : ""
      }\n\n${summary.summary ? `Summary: ${summary.summary}\n\n` : ""}${summary.transcript.slice(0, 4000)}`,
      externalId: `vapi:${summary.externalId}`,
      providerMetadata: { vapi: true, recordingUrl: summary.recordingUrl },
      deliveredAt: summary.endedAt ?? summary.startedAt ?? new Date(),
    });
  }

  return NextResponse.json({ ok: true });
}
