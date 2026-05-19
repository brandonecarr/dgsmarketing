import { NextResponse } from "next/server";
import { z } from "zod";
import { db, leads, STAGE_ORDER } from "@rosie/db";
import { and, desc, eq } from "@rosie/db";
import { apiErrorResponse, authenticateApiRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

const PostBody = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  source: z
    .enum(["sms_inbound", "fb_lead_form", "web_form", "make_webhook", "manual", "import"])
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(req: Request) {
  try {
    const auth = await authenticateApiRequest(req, "leads:read");
    const url = new URL(req.url);
    const stage = url.searchParams.get("stage");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

    const rows = await db
      .select()
      .from(leads)
      .where(
        stage && (STAGE_ORDER as readonly string[]).includes(stage)
          ? and(
              eq(leads.tenantId, auth.tenantId),
              eq(leads.stage, stage as (typeof STAGE_ORDER)[number]),
            )
          : eq(leads.tenantId, auth.tenantId),
      )
      .orderBy(desc(leads.createdAt))
      .limit(limit);

    return NextResponse.json({ data: rows });
  } catch (e) {
    return apiErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await authenticateApiRequest(req, "leads:write");
    const parsed = PostBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    if (!parsed.data.phone && !parsed.data.email) {
      return NextResponse.json({ error: "phone or email required" }, { status: 400 });
    }
    const now = new Date();
    const [row] = await db
      .insert(leads)
      .values({
        tenantId: auth.tenantId,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        source: parsed.data.source ?? "manual",
        stage: "new",
        metadata: parsed.data.metadata,
        firstContactAt: now,
        lastMessageAt: now,
      })
      .returning();
    return NextResponse.json({ data: row });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
