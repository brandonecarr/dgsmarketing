import { NextResponse } from "next/server";
import { loadActiveSession } from "@/lib/active-tenant";
import { replayDlq } from "@/lib/dlq";
import { recordAudit } from "@/lib/audit";

// Importing fire.ts as a side-effect registers the CAPI replayers. Add new
// replayer modules here as you ship them.
import "@/lib/conversions/fire";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  const result = await replayDlq(id);

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "tenant.update",
    entityType: "dlq",
    entityId: id,
    summary: result.ok ? "Replayed DLQ entry" : `DLQ replay failed: ${result.error}`,
    payload: { dlqId: id, result },
    headers: req.headers,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
