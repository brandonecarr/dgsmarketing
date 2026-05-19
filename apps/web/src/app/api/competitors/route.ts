import { NextResponse } from "next/server";
import { z } from "zod";
import { db, competitors } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Body = z.object({
  name: z.string().min(1).max(120),
  domain: z.string().max(200).optional().nullable(),
  gbpUrl: z.string().url().max(500).optional().nullable(),
  metaPageId: z.string().max(80).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const runtime = "nodejs";

export async function GET() {
  const session = await loadActiveSession();
  const rows = await db
    .select()
    .from(competitors)
    .where(eq(competitors.tenantId, session.tenant.id))
    .orderBy(desc(competitors.createdAt));
  return NextResponse.json({ competitors: rows });
}

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const [row] = await db
    .insert(competitors)
    .values({
      tenantId: session.tenant.id,
      name: parsed.data.name,
      domain: parsed.data.domain ?? null,
      gbpUrl: parsed.data.gbpUrl ?? null,
      metaPageId: parsed.data.metaPageId ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();
  return NextResponse.json({ ok: true, competitor: row });
}
