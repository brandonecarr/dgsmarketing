import { NextResponse } from "next/server";
import { z } from "zod";
import { db, tenants } from "@rosie/db";
import { eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({
  residencyOnly: z.boolean(),
});

export async function PATCH(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  await db
    .update(tenants)
    .set({
      // Stored as text so we can later extend to "strict" / "stricter" tiers
      // without another column shape.
      residencyOnly: parsed.data.residencyOnly ? "strict" : null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, session.tenant.id));

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "tenant.update",
    entityType: "tenant",
    entityId: session.tenant.id,
    summary: parsed.data.residencyOnly
      ? "Enabled strict data residency"
      : "Disabled strict data residency",
    payload: { residencyOnly: parsed.data.residencyOnly },
    headers: req.headers,
  });

  return NextResponse.json({ ok: true });
}
