import { NextResponse } from "next/server";
import {
  db,
  bulkMessages,
  bulkMessageRecipients,
  conversations,
  messages,
  leads,
  integrations,
} from "@rosie/db";
import { and, eq, or } from "@rosie/db";
import { getProvider } from "@rosie/messaging";
import { loadActiveSession } from "@/lib/active-tenant";
import { previewBulkRecipients } from "@/lib/bulk-messages/recipients";
import { decryptJson } from "@/lib/crypto";
import { checkBudget, recordUsage } from "@/lib/usage";
import { isOptedOut } from "@/lib/compliance/sms";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;

  const [bulk] = await db
    .select()
    .from(bulkMessages)
    .where(and(eq(bulkMessages.id, id), eq(bulkMessages.tenantId, session.tenant.id)))
    .limit(1);
  if (!bulk) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Materialize recipients (re-runs filter at send time so it reflects current data).
  const recipients = await previewBulkRecipients(session.tenant.id, bulk.filter, 1000);

  // Budget check: refuse if sending would blow the SMS cap.
  const verdict = await checkBudget({
    tenantId: session.tenant.id,
    kind: "sms",
    units: recipients.length,
  });
  if (!verdict.allowed) {
    return NextResponse.json({ error: verdict.reason }, { status: 402 });
  }

  // Find an SMS integration.
  const [integ] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, session.tenant.id),
        or(eq(integrations.provider, "quo"), eq(integrations.provider, "openphone")),
      ),
    )
    .limit(1);
  const creds = decryptJson<{ apiKey?: string; fromId?: string; fromNumber?: string }>(
    integ?.secrets,
  ) ?? {};
  const providerName = integ?.provider as "quo" | "openphone" | undefined;

  await db
    .update(bulkMessages)
    .set({ status: "sending", updatedAt: new Date() })
    .where(eq(bulkMessages.id, bulk.id));

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const r of recipients) {
    try {
      // TCPA: skip opted-out numbers. Record as skipped (not failed) so
      // operators can see how many were filtered.
      if (await isOptedOut(session.tenant.id, r.phone)) {
        await db.insert(bulkMessageRecipients).values({
          tenantId: session.tenant.id,
          bulkMessageId: bulk.id,
          leadId: r.leadId,
          phone: r.phone,
          status: "skipped",
          error: "opted_out",
        });
        skipped += 1;
        continue;
      }

      const [recipientRow] = await db
        .insert(bulkMessageRecipients)
        .values({
          tenantId: session.tenant.id,
          bulkMessageId: bulk.id,
          leadId: r.leadId,
          phone: r.phone,
          status: "pending",
        })
        .returning({ id: bulkMessageRecipients.id });

      let externalId: string | null = null;
      if (providerName && creds.apiKey) {
        try {
          const result = await getProvider(providerName).sendSms(
            { to: r.phone, body: bulk.body },
            { apiKey: creds.apiKey, fromId: creds.fromId, fromNumber: creds.fromNumber },
          );
          externalId = result.externalId;
        } catch (e) {
          await db
            .update(bulkMessageRecipients)
            .set({
              status: "failed",
              error: e instanceof Error ? e.message : String(e),
              sentAt: new Date(),
            })
            .where(eq(bulkMessageRecipients.id, recipientRow!.id));
          failed += 1;
          continue;
        }
      } else {
        skipped += 1;
      }

      // Persist as outbound message on the lead's conversation.
      const [conv] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.tenantId, session.tenant.id),
            eq(conversations.participantPhone, r.phone),
          ),
        )
        .limit(1);
      let conversationId = conv?.id;
      if (!conversationId) {
        const [newConv] = await db
          .insert(conversations)
          .values({
            tenantId: session.tenant.id,
            leadId: r.leadId,
            channel: "sms",
            provider: providerName ?? "manual",
            participantPhone: r.phone,
            participantName: r.name,
            lastMessageAt: new Date(),
            lastMessagePreview: bulk.body.slice(0, 140),
          })
          .returning({ id: conversations.id });
        conversationId = newConv?.id;
      }

      if (conversationId) {
        await db.insert(messages).values({
          tenantId: session.tenant.id,
          conversationId,
          direction: "outbound",
          senderType: "operator",
          body: bulk.body,
          externalId,
          deliveredAt: new Date(),
        });
        await db
          .update(conversations)
          .set({
            lastMessageAt: new Date(),
            lastMessagePreview: bulk.body.slice(0, 140),
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));
        await db
          .update(leads)
          .set({ lastMessageAt: new Date(), updatedAt: new Date() })
          .where(eq(leads.id, r.leadId));
      }

      await db
        .update(bulkMessageRecipients)
        .set({ status: externalId ? "sent" : "skipped", sentAt: new Date(), externalId })
        .where(eq(bulkMessageRecipients.id, recipientRow!.id));

      if (externalId) {
        sent += 1;
        await recordUsage({
          tenantId: session.tenant.id,
          kind: "sms_sent",
          units: 1,
          costUsd: Number(process.env.ROSIE_SMS_UNIT_COST_USD ?? 0.01),
          source: "bulk",
          meta: { bulkMessageId: bulk.id },
        });
      }
    } catch (e) {
      failed += 1;
      console.error("bulk recipient processing failed", e);
    }
  }

  await db
    .update(bulkMessages)
    .set({
      status: failed === recipients.length && recipients.length > 0 ? "failed" : "completed",
      sentAt: new Date(),
      recipientCount: recipients.length.toString(),
      updatedAt: new Date(),
    })
    .where(eq(bulkMessages.id, bulk.id));

  return NextResponse.json({ ok: true, sent, failed, skipped, recipients: recipients.length });
}
