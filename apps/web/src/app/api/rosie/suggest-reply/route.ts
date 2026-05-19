import { NextResponse } from "next/server";
import { z } from "zod";
import { suggestReply } from "@rosie/ai";
import { db, conversations, messages, leads } from "@rosie/db";
import { and, asc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  conversationId: z.string().uuid(),
  instruction: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const conv = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, parsed.data.conversationId),
        eq(conversations.tenantId, session.tenant.id),
      ),
    )
    .limit(1);
  if (!conv[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const history = await db
    .select({ direction: messages.direction, body: messages.body })
    .from(messages)
    .where(eq(messages.conversationId, conv[0].id))
    .orderBy(asc(messages.createdAt))
    .limit(40);

  let leadMeta: Record<string, unknown> | undefined;
  if (conv[0].leadId) {
    const leadRow = await db
      .select()
      .from(leads)
      .where(eq(leads.id, conv[0].leadId))
      .limit(1);
    if (leadRow[0]) {
      leadMeta = {
        name: leadRow[0].name,
        phone: leadRow[0].phone,
        email: leadRow[0].email,
        stage: leadRow[0].stage,
        ...(leadRow[0].metadata ?? {}),
      };
    }
  }

  const result = await suggestReply({
    context: {
      tenantName: session.tenant.name,
      category: session.profile?.category ?? undefined,
      city: session.profile?.address?.city ?? undefined,
      services: session.profile?.services ?? undefined,
    },
    history,
    leadMeta,
    instruction: parsed.data.instruction,
  });

  return NextResponse.json({ ok: true, ...result });
}
