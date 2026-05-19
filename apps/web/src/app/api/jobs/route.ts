import { NextResponse } from "next/server";
import { z } from "zod";
import { db, jobs } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Body = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(4000).optional(),
  requirements: z.string().max(4000).optional(),
  compensation: z.string().max(200).optional(),
  status: z.enum(["draft", "open", "paused", "closed"]).optional(),
});

export const runtime = "nodejs";

export async function GET() {
  const session = await loadActiveSession();
  const rows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.tenantId, session.tenant.id))
    .orderBy(desc(jobs.createdAt));
  return NextResponse.json({ jobs: rows });
}

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const [row] = await db
    .insert(jobs)
    .values({
      tenantId: session.tenant.id,
      title: parsed.data.title,
      description: parsed.data.description,
      requirements: parsed.data.requirements,
      compensation: parsed.data.compensation,
      status: parsed.data.status ?? "draft",
    })
    .returning();
  return NextResponse.json({ ok: true, job: row });
}
