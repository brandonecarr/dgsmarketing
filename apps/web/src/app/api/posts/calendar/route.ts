import { NextResponse } from "next/server";
import { z } from "zod";
import { planPostCalendar, type PostPlatform } from "@rosie/ai";
import { loadActiveSession } from "@/lib/active-tenant";

const Body = z.object({
  platform: z.enum(["facebook", "instagram", "google_business", "linkedin", "tiktok"]),
  weeks: z.union([z.literal(2), z.literal(4)]),
  postsPerWeek: z.number().int().min(1).max(7).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const items = await planPostCalendar({
    context: {
      tenantName: session.tenant.name,
      category: session.profile?.category ?? undefined,
      city: session.profile?.address?.city ?? undefined,
      services: session.profile?.services ?? undefined,
    },
    voice: session.profile?.brandVoice ?? undefined,
    platform: parsed.data.platform as PostPlatform,
    weeks: parsed.data.weeks,
    postsPerWeek: parsed.data.postsPerWeek,
    startDate: parsed.data.startDate,
  });

  return NextResponse.json({ ok: true, items });
}
