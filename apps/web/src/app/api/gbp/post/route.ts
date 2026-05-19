import { NextResponse } from "next/server";
import { z } from "zod";
import { createLocalPost, GbpError } from "@/lib/google/gbp";
import { loadActiveSession } from "@/lib/active-tenant";

const Body = z.object({
  locationName: z.string(),
  summary: z.string().min(1).max(1500),
  actionUrl: z.string().url().optional(),
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  try {
    const res = await createLocalPost(session.tenant.id, parsed.data.locationName, {
      summary: parsed.data.summary,
      callToAction: parsed.data.actionUrl
        ? { actionType: "LEARN_MORE", url: parsed.data.actionUrl }
        : undefined,
    });
    return NextResponse.json({ ok: true, name: res.name });
  } catch (e) {
    if (e instanceof GbpError) {
      return NextResponse.json({ error: e.message }, { status: e.status ?? 502 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "post failed" },
      { status: 502 },
    );
  }
}
