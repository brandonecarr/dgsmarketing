import { NextResponse } from "next/server";
import { z } from "zod";
import { loadActiveSession } from "@/lib/active-tenant";
import { resolveDlq } from "@/lib/dlq";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({
  reason: z.enum(["manual", "abandoned"]).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const reason = parsed.success ? parsed.data.reason ?? "manual" : "manual";

  await resolveDlq(id, reason);

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "tenant.update",
    entityType: "dlq",
    entityId: id,
    summary: reason === "abandoned" ? "Abandoned DLQ entry" : "Marked DLQ entry resolved",
    payload: { dlqId: id, reason },
    headers: req.headers,
  });

  return NextResponse.json({ ok: true });
}
