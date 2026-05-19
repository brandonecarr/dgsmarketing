import { NextResponse } from "next/server";
import { db, specialists } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  await db
    .delete(specialists)
    .where(and(eq(specialists.id, id), eq(specialists.tenantId, session.tenant.id)));
  return NextResponse.json({ ok: true });
}
