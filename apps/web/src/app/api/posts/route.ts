import { NextResponse } from "next/server";
import { z } from "zod";
import { db, posts } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Body = z.object({
  platform: z.enum(["facebook", "instagram", "google_business", "linkedin", "tiktok"]).default("facebook"),
  body: z.string().min(1).max(5000),
  title: z.string().max(200).optional(),
  scheduledFor: z.string().datetime().optional(),
  aiMeta: z.record(z.unknown()).optional(),
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const [row] = await db
    .insert(posts)
    .values({
      tenantId: session.tenant.id,
      createdByUserId: session.user.id,
      platform: parsed.data.platform,
      body: parsed.data.body,
      title: parsed.data.title,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null,
      status: parsed.data.scheduledFor ? "scheduled" : "draft",
      brandVoiceSnapshot: session.profile?.brandVoice ?? null,
      aiMeta: parsed.data.aiMeta ?? null,
    })
    .returning();

  return NextResponse.json({ ok: true, post: row });
}
