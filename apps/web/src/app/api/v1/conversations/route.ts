import { NextResponse } from "next/server";
import { db, conversations, leads } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { apiErrorResponse, authenticateApiRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const auth = await authenticateApiRequest(req, "conversations:read");
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    const rows = await db
      .select({
        id: conversations.id,
        leadId: conversations.leadId,
        leadStage: leads.stage,
        provider: conversations.provider,
        channel: conversations.channel,
        participantPhone: conversations.participantPhone,
        participantName: conversations.participantName,
        lastMessageAt: conversations.lastMessageAt,
        lastMessagePreview: conversations.lastMessagePreview,
        unreadCount: conversations.unreadCount,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .leftJoin(leads, eq(leads.id, conversations.leadId))
      .where(eq(conversations.tenantId, auth.tenantId))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit);
    return NextResponse.json({ data: rows });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
