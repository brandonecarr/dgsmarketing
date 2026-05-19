import { NextResponse } from "next/server";
import { z } from "zod";
import { db, competitors } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  domain: z.string().max(200).nullable().optional(),
  gbpUrl: z.string().url().max(500).nullable().optional(),
  metaPageId: z.string().max(80).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
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
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) patch[k] = v;
  }

  const result = await db
    .update(competitors)
    .set(patch)
    .where(and(eq(competitors.id, id), eq(competitors.tenantId, session.tenant.id)))
    .returning();
  if (!result[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, competitor: result[0] });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  await db
    .delete(competitors)
    .where(and(eq(competitors.id, id), eq(competitors.tenantId, session.tenant.id)));
  return NextResponse.json({ ok: true });
}
