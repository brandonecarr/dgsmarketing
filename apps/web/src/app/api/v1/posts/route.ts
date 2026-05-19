import { NextResponse } from "next/server";
import { z } from "zod";
import { db, posts } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { apiErrorResponse, authenticateApiRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

const PostBody = z.object({
  platform: z
    .enum(["facebook", "instagram", "google_business", "linkedin", "tiktok"])
    .default("facebook"),
  body: z.string().min(1).max(5000),
  title: z.string().max(200).optional(),
  scheduledFor: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  try {
    const auth = await authenticateApiRequest(req, "posts:read");
    const rows = await db
      .select()
      .from(posts)
      .where(eq(posts.tenantId, auth.tenantId))
      .orderBy(desc(posts.createdAt))
      .limit(100);
    return NextResponse.json({ data: rows });
  } catch (e) {
    return apiErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await authenticateApiRequest(req, "posts:write");
    const parsed = PostBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const [row] = await db
      .insert(posts)
      .values({
        tenantId: auth.tenantId,
        platform: parsed.data.platform,
        body: parsed.data.body,
        title: parsed.data.title,
        scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null,
        status: parsed.data.scheduledFor ? "scheduled" : "draft",
      })
      .returning();
    return NextResponse.json({ data: row });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
