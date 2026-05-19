import { NextResponse } from "next/server";
import { z } from "zod";
import { db, webhookSubscriptions } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const PatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  url: z.string().url().optional(),
  enabled: z.boolean().optional(),
  events: z.array(z.string()).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.url !== undefined) update.url = parsed.data.url;
  if (parsed.data.events !== undefined) update.events = parsed.data.events;
  if (parsed.data.enabled !== undefined) {
    update.enabled = parsed.data.enabled;
    if (parsed.data.enabled) {
      // Re-enabling clears the suspension marker.
      update.suspendedAt = null;
      update.suspendedReason = null;
    }
  }

  await db
    .update(webhookSubscriptions)
    .set(update)
    .where(
      and(
        eq(webhookSubscriptions.id, id),
        eq(webhookSubscriptions.tenantId, session.tenant.id),
      ),
    );

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "integration.update",
    entityType: "webhook_subscription",
    entityId: id,
    summary: "Updated webhook subscription",
    payload: parsed.data,
    headers: req.headers,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  await db
    .delete(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.id, id),
        eq(webhookSubscriptions.tenantId, session.tenant.id),
      ),
    );
  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "integration.disconnect",
    entityType: "webhook_subscription",
    entityId: id,
    summary: "Deleted webhook subscription",
    headers: req.headers,
  });
  return NextResponse.json({ ok: true });
}
