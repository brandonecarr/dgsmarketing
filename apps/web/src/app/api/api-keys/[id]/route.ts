import { NextResponse } from "next/server";
import { db, apiKeys } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  const [revoked] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, session.tenant.id)))
    .returning({ name: apiKeys.name, prefix: apiKeys.prefix });
  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "api_key.revoke",
    entityType: "api_key",
    entityId: id,
    summary: revoked ? `Revoked API key "${revoked.name}" (${revoked.prefix}…)` : "Revoked API key",
    headers: req.headers,
  });
  return NextResponse.json({ ok: true });
}
