import { NextResponse } from "next/server";
import { z } from "zod";
import { db, jobs } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Patch = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(4000).optional(),
  requirements: z.string().max(4000).optional(),
  compensation: z.string().max(200).optional(),
  status: z.enum(["draft", "open", "paused", "closed"]).optional(),
});

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(parsed.data)) if (v !== undefined) patch[k] = v;
  const [row] = await db
    .update(jobs)
    .set(patch)
    .where(and(eq(jobs.id, id), eq(jobs.tenantId, session.tenant.id)))
    .returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, job: row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  await db.delete(jobs).where(and(eq(jobs.id, id), eq(jobs.tenantId, session.tenant.id)));
  return NextResponse.json({ ok: true });
}
