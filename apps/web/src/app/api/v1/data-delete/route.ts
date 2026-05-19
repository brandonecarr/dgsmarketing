import { NextResponse } from "next/server";
import { z } from "zod";
import {
  db,
  leads,
  conversations,
  messages,
  consentRecords,
  smsOptOuts,
  dsarRequests,
} from "@rosie/db";
import { and, eq, inArray, or } from "@rosie/db";
import { apiErrorResponse, authenticateApiRequest } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(7).max(30).optional(),
  /** When true, also record an STOP/opt-out on the phone(s) so we never message again. */
  alsoOptOutSms: z.boolean().optional(),
});

/**
 * GDPR Article 17 ("right to erasure") + CCPA "right to delete". Cascades
 * through every personal-data table for the authenticated tenant.
 *
 * Conversations + messages are deleted because they're keyed by leadId.
 * Consent records are kept by some interpretations of GDPR (audit trail) but
 * we delete them here too — the legal basis for keeping them disappears once
 * the lead is gone. We do leave an audit log entry so the deletion itself is
 * provable.
 */
export async function POST(req: Request) {
  try {
    const auth = await authenticateApiRequest(req, "data:delete");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success || (!parsed.data.email && !parsed.data.phone)) {
      return NextResponse.json({ error: "email or phone required" }, { status: 400 });
    }

    const where = and(
      eq(leads.tenantId, auth.tenantId),
      or(
        parsed.data.email ? eq(leads.email, parsed.data.email) : undefined,
        parsed.data.phone ? eq(leads.phone, parsed.data.phone) : undefined,
      ),
    );

    const matched = await db.select({ id: leads.id, phone: leads.phone }).from(leads).where(where);
    const leadIds = matched.map((l) => l.id);

    let deletedMessages = 0;
    let deletedConversations = 0;
    if (leadIds.length > 0) {
      const convs = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(eq(conversations.tenantId, auth.tenantId), inArray(conversations.leadId, leadIds)),
        );
      const convIds = convs.map((c) => c.id);
      if (convIds.length > 0) {
        const delMsgs = await db
          .delete(messages)
          .where(and(eq(messages.tenantId, auth.tenantId), inArray(messages.conversationId, convIds)))
          .returning({ id: messages.id });
        deletedMessages = delMsgs.length;
        const delConvs = await db
          .delete(conversations)
          .where(and(eq(conversations.tenantId, auth.tenantId), inArray(conversations.id, convIds)))
          .returning({ id: conversations.id });
        deletedConversations = delConvs.length;
      }
    }

    const delConsents = await db
      .delete(consentRecords)
      .where(
        and(
          eq(consentRecords.tenantId, auth.tenantId),
          or(
            parsed.data.email ? eq(consentRecords.email, parsed.data.email) : undefined,
            parsed.data.phone ? eq(consentRecords.phone, parsed.data.phone) : undefined,
          ),
        ),
      )
      .returning({ id: consentRecords.id });

    let deletedLeads = 0;
    if (leadIds.length > 0) {
      const delLeads = await db
        .delete(leads)
        .where(and(eq(leads.tenantId, auth.tenantId), inArray(leads.id, leadIds)))
        .returning({ id: leads.id });
      deletedLeads = delLeads.length;
    }

    // If the requester asked for SMS opt-out alongside deletion, persist that
    // — otherwise the next time the number comes back in via a webhook we'd
    // legally be allowed to re-message it.
    if (parsed.data.alsoOptOutSms && parsed.data.phone) {
      await db
        .insert(smsOptOuts)
        .values({
          tenantId: auth.tenantId,
          phone: parsed.data.phone,
          source: "dsar_request",
          notes: "Auto-recorded during /v1/data-delete",
        })
        .onConflictDoNothing();
    }

    // Mark any open DSAR request rows as completed.
    await db
      .update(dsarRequests)
      .set({ status: "completed", completedAt: new Date() })
      .where(
        and(
          eq(dsarRequests.tenantId, auth.tenantId),
          or(
            parsed.data.email ? eq(dsarRequests.email, parsed.data.email) : undefined,
            parsed.data.phone ? eq(dsarRequests.phone, parsed.data.phone) : undefined,
          ),
        ),
      );

    await recordAudit({
      tenantId: auth.tenantId,
      actorLabel: "system",
      action: "data.delete_request",
      summary: `Deleted personal data for ${parsed.data.email ?? parsed.data.phone}`,
      payload: {
        email: parsed.data.email,
        phone: parsed.data.phone,
        deletedLeads,
        deletedConversations,
        deletedMessages,
        deletedConsents: delConsents.length,
      },
      headers: req.headers,
    });

    return NextResponse.json({
      ok: true,
      deletedLeads,
      deletedConversations,
      deletedMessages,
      deletedConsents: delConsents.length,
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
