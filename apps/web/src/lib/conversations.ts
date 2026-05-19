import { db, conversations, leads, messages, tenants } from "@rosie/db";
import { and, eq, sql } from "@rosie/db";
import type { InboundMessage, ProviderName } from "@rosie/messaging";

export async function resolveTenantBySlug(slug: string) {
  const rows = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return rows[0] ?? null;
}

interface IngestResult {
  conversationId: string;
  messageId: string;
  leadId: string | null;
  isNewConversation: boolean;
  isDuplicate: boolean;
}

/**
 * Idempotently records an inbound SMS:
 *  - dedupes on (provider, externalId) message id
 *  - finds-or-creates the conversation by (provider, externalConversationId) || (tenant, participantPhone)
 *  - finds-or-creates a Lead in `new` stage when no conversation exists
 *  - bumps the conversation's preview + unread count
 */
export async function ingestInboundMessage(
  tenantId: string,
  msg: InboundMessage,
): Promise<IngestResult> {
  return await db.transaction(async (tx) => {
    // 1. Dedupe by external message id (unique index on messages.external_id).
    const dup = await tx
      .select({ id: messages.id, conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.externalId, msg.externalId))
      .limit(1);
    if (dup[0]) {
      const conv = await tx
        .select({ leadId: conversations.leadId })
        .from(conversations)
        .where(eq(conversations.id, dup[0].conversationId))
        .limit(1);
      return {
        conversationId: dup[0].conversationId,
        messageId: dup[0].id,
        leadId: conv[0]?.leadId ?? null,
        isNewConversation: false,
        isDuplicate: true,
      };
    }

    // 2. Find conversation by (provider, externalConversationId) first.
    let conversation = msg.externalConversationId
      ? (
          await tx
            .select()
            .from(conversations)
            .where(
              and(
                eq(conversations.provider, msg.provider),
                eq(conversations.externalId, msg.externalConversationId),
              ),
            )
            .limit(1)
        )[0]
      : undefined;

    // 3. Fall back to (tenant, participantPhone).
    if (!conversation) {
      const candidates = await tx
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.tenantId, tenantId),
            eq(conversations.participantPhone, msg.fromNumber),
          ),
        )
        .limit(1);
      conversation = candidates[0];
    }

    let isNewConversation = false;
    let leadId: string | null = conversation?.leadId ?? null;

    if (!conversation) {
      // 4. Create a new Lead for this number.
      const [newLead] = await tx
        .insert(leads)
        .values({
          tenantId,
          name: msg.fromName ?? null,
          phone: msg.fromNumber,
          source: "sms_inbound",
          stage: "new",
          firstContactAt: msg.receivedAt,
          lastMessageAt: msg.receivedAt,
        })
        .returning({ id: leads.id });

      leadId = newLead?.id ?? null;

      const [newConv] = await tx
        .insert(conversations)
        .values({
          tenantId,
          leadId,
          channel: "sms",
          provider: msg.provider,
          externalId: msg.externalConversationId ?? null,
          participantPhone: msg.fromNumber,
          participantName: msg.fromName ?? null,
          lastMessageAt: msg.receivedAt,
          lastMessagePreview: msg.body.slice(0, 140),
          unreadCount: 1,
        })
        .returning();
      conversation = newConv;
      isNewConversation = true;
    } else {
      // Bump counters / preview.
      await tx
        .update(conversations)
        .set({
          lastMessageAt: msg.receivedAt,
          lastMessagePreview: msg.body.slice(0, 140),
          unreadCount: sql`${conversations.unreadCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversation.id));

      if (leadId) {
        await tx
          .update(leads)
          .set({ lastMessageAt: msg.receivedAt, updatedAt: new Date() })
          .where(eq(leads.id, leadId));
      }
    }

    if (!conversation) throw new Error("conversation could not be created");

    const [newMsg] = await tx
      .insert(messages)
      .values({
        tenantId,
        conversationId: conversation.id,
        direction: "inbound",
        senderType: "lead",
        body: msg.body,
        externalId: msg.externalId,
        providerMetadata: msg.raw as Record<string, unknown> | undefined,
        deliveredAt: msg.receivedAt,
      })
      .returning({ id: messages.id });

    return {
      conversationId: conversation.id,
      messageId: newMsg!.id,
      leadId,
      isNewConversation,
      isDuplicate: false,
    };
  });
}

const PROVIDER_NAMES: ProviderName[] = ["quo", "openphone"];
export function assertProviderName(value: string): ProviderName {
  if ((PROVIDER_NAMES as string[]).includes(value)) return value as ProviderName;
  throw new Error(`Unknown provider: ${value}`);
}
