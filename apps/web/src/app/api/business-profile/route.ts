import { NextResponse } from "next/server";
import { z } from "zod";
import { db, businessProfile, tenants } from "@rosie/db";
import { eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Body = z.object({
  name: z.string().min(1).max(120),
  category: z.string().max(120).optional().default(""),
  city: z.string().max(120).optional().default(""),
  services: z.array(z.string()).optional().default([]),
  brandVoice: z
    .object({
      storytellingStrategy: z.string().max(4000).optional(),
      contentPersonality: z.string().max(500).optional(),
      sellingStyle: z.string().max(500).optional(),
      postLength: z.string().max(120).optional(),
      guardrails: z.string().max(4000).optional(),
      recurringCharacters: z
        .array(
          z.object({
            name: z.string().max(120),
            role: z.string().max(120),
            description: z.string().max(500),
            profile: z.record(z.unknown()).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const data = parsed.data;

  await db.update(tenants).set({ name: data.name, updatedAt: new Date() }).where(eq(tenants.id, session.tenant.id));

  const existing = await db
    .select({ tenantId: businessProfile.tenantId })
    .from(businessProfile)
    .where(eq(businessProfile.tenantId, session.tenant.id))
    .limit(1);

  const profilePatch = {
    category: data.category || null,
    services: data.services,
    address: { ...(session.profile?.address ?? {}), city: data.city || undefined },
    brandVoice: data.brandVoice ?? {},
    updatedAt: new Date(),
  };

  if (existing[0]) {
    await db
      .update(businessProfile)
      .set(profilePatch)
      .where(eq(businessProfile.tenantId, session.tenant.id));
  } else {
    await db.insert(businessProfile).values({
      tenantId: session.tenant.id,
      ...profilePatch,
      legalName: data.name,
    });
  }

  return NextResponse.json({ ok: true });
}
