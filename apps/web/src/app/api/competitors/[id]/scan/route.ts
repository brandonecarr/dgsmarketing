import { NextResponse } from "next/server";
import { db, competitors } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { scanCompetitor } from "@/lib/competitors/scan";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  const [comp] = await db
    .select()
    .from(competitors)
    .where(and(eq(competitors.id, id), eq(competitors.tenantId, session.tenant.id)))
    .limit(1);
  if (!comp) return NextResponse.json({ error: "not found" }, { status: 404 });

  const result = await scanCompetitor({ tenantId: session.tenant.id, competitor: comp });
  return NextResponse.json({ ok: true, ...result });
}
