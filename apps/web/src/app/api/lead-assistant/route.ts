import { NextResponse } from "next/server";
import { z } from "zod";
import { db, businessProfile } from "@rosie/db";
import { eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Body = z.object({
  enabled: z.boolean(),
  instruction: z.string().max(2000).optional(),
});

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const next = {
    ...(session.profile?.features ?? {}),
    leadAssistantEnabled: parsed.data.enabled,
    leadAssistantInstruction: parsed.data.instruction ?? session.profile?.features?.leadAssistantInstruction,
  };
  await db
    .update(businessProfile)
    .set({ features: next, updatedAt: new Date() })
    .where(eq(businessProfile.tenantId, session.tenant.id));
  return NextResponse.json({ ok: true, features: next });
}
