import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db, webhookSubscriptions } from "@rosie/db";
import { and, desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const ALL_EVENTS = [
  "lead.created",
  "lead.stage_changed",
  "lead.won",
  "conversation.message_received",
  "conversation.message_sent",
  "call.completed",
  "review.received",
] as const;

const Body = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  events: z.array(z.enum(ALL_EVENTS)).default([]),
});

export async function GET() {
  const session = await loadActiveSession();
  const rows = await db
    .select({
      id: webhookSubscriptions.id,
      name: webhookSubscriptions.name,
      url: webhookSubscriptions.url,
      events: webhookSubscriptions.events,
      enabled: webhookSubscriptions.enabled,
      suspendedAt: webhookSubscriptions.suspendedAt,
      suspendedReason: webhookSubscriptions.suspendedReason,
      createdAt: webhookSubscriptions.createdAt,
    })
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.tenantId, session.tenant.id))
    .orderBy(desc(webhookSubscriptions.createdAt));
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  // Generate the signing secret. Operator sees this once.
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;

  const [row] = await db
    .insert(webhookSubscriptions)
    .values({
      tenantId: session.tenant.id,
      name: parsed.data.name,
      url: parsed.data.url,
      events: parsed.data.events,
      secret,
    })
    .returning({ id: webhookSubscriptions.id });

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "integration.connect",
    entityType: "webhook_subscription",
    entityId: row?.id,
    summary: `Created webhook subscription "${parsed.data.name}"`,
    payload: { url: parsed.data.url, events: parsed.data.events },
    headers: req.headers,
  });

  return NextResponse.json({ ok: true, id: row?.id, secret });
}
