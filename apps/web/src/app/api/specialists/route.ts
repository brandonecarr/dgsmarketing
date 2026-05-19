import { NextResponse } from "next/server";
import { z } from "zod";
import { db, specialists } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Body = z.object({
  name: z.string().min(1).max(120),
  category: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().email().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().max(40)).optional(),
  active: z.boolean().optional(),
});

export const runtime = "nodejs";

export async function GET() {
  const session = await loadActiveSession();
  const rows = await db
    .select()
    .from(specialists)
    .where(eq(specialists.tenantId, session.tenant.id))
    .orderBy(desc(specialists.createdAt));
  return NextResponse.json({ specialists: rows });
}

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const [row] = await db
    .insert(specialists)
    .values({
      tenantId: session.tenant.id,
      name: parsed.data.name,
      category: parsed.data.category ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      notes: parsed.data.notes ?? null,
      tags: parsed.data.tags,
      active: parsed.data.active ?? true,
    })
    .returning();
  return NextResponse.json({ ok: true, specialist: row });
}
