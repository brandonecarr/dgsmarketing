import { NextResponse } from "next/server";
import { z } from "zod";
import { db, leads } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Body = z.object({ isCommercial: z.boolean() });

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  await db
    .update(leads)
    .set({ isCommercial: parsed.data.isCommercial ? 1 : 0, updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.tenantId, session.tenant.id)));
  return NextResponse.json({ ok: true });
}
