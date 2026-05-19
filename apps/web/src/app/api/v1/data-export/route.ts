import { NextResponse } from "next/server";
import { z } from "zod";
import {
  db,
  leads,
  conversations,
  messages,
  consentRecords,
  smsOptOuts,
} from "@rosie/db";
import { and, eq, or } from "@rosie/db";
import { apiErrorResponse, authenticateApiRequest } from "@/lib/api-auth";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(7).max(30).optional(),
});

/**
 * Returns every personal data record we hold for a given email/phone within
 * the authenticated tenant. Used to fulfill GDPR Article 20 (portability) +
 * CCPA "right to know" requests.
 */
export async function POST(req: Request) {
  try {
    const auth = await authenticateApiRequest(req, "data:export");
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

    const matchedLeads = await db.select().from(leads).where(where);
    const leadIds = matchedLeads.map((l) => l.id);

    const [convs, msgs, consents, optOuts] = await Promise.all([
      leadIds.length > 0
        ? db
            .select()
            .from(conversations)
            .where(
              and(
                eq(conversations.tenantId, auth.tenantId),
                or(...leadIds.map((id) => eq(conversations.leadId, id))),
              ),
            )
        : Promise.resolve([]),
      leadIds.length > 0
        ? db.select().from(messages).where(eq(messages.tenantId, auth.tenantId))
        : Promise.resolve([]),
      db
        .select()
        .from(consentRecords)
        .where(
          and(
            eq(consentRecords.tenantId, auth.tenantId),
            or(
              parsed.data.email ? eq(consentRecords.email, parsed.data.email) : undefined,
              parsed.data.phone ? eq(consentRecords.phone, parsed.data.phone) : undefined,
            ),
          ),
        ),
      parsed.data.phone
        ? db
            .select()
            .from(smsOptOuts)
            .where(
              and(eq(smsOptOuts.tenantId, auth.tenantId), eq(smsOptOuts.phone, parsed.data.phone)),
            )
        : Promise.resolve([]),
    ]);

    await recordAudit({
      tenantId: auth.tenantId,
      actorLabel: "system",
      action: "lead.export",
      summary: `Exported personal data for ${parsed.data.email ?? parsed.data.phone}`,
      payload: { email: parsed.data.email, phone: parsed.data.phone, leadCount: matchedLeads.length },
      headers: req.headers,
    });

    return NextResponse.json({
      query: { email: parsed.data.email, phone: parsed.data.phone },
      leads: matchedLeads,
      conversations: convs,
      messages: msgs.filter((m) => convs.some((c) => c.id === m.conversationId)),
      consentRecords: consents,
      smsOptOuts: optOuts,
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
