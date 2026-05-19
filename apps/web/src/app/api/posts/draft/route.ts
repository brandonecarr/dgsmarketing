import { NextResponse } from "next/server";
import { z } from "zod";
import { draftPost, type PostPlatform } from "@rosie/ai";
import { loadActiveSession } from "@/lib/active-tenant";

const Body = z.object({
  platform: z.enum(["facebook", "instagram", "google_business", "linkedin", "tiktok"]),
  topic: z.string().max(400).optional(),
  characterName: z.string().max(120).optional(),
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const result = await draftPost({
    context: {
      tenantName: session.tenant.name,
      category: session.profile?.category ?? undefined,
      city: session.profile?.address?.city ?? undefined,
      services: session.profile?.services ?? undefined,
    },
    voice: session.profile?.brandVoice ?? undefined,
    platform: parsed.data.platform as PostPlatform,
    topic: parsed.data.topic,
    characterName: parsed.data.characterName,
  });

  return NextResponse.json({ ok: true, ...result });
}
