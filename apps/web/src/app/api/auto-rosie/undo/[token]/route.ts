import { NextResponse } from "next/server";
import { db, autoRosieRuns } from "@rosie/db";
import { and, eq, isNotNull } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { undoRunDiff } from "@/lib/auto-rosie/agent/dispatch";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await loadActiveSession();
  const { token } = await params;

  const [run] = await db
    .select()
    .from(autoRosieRuns)
    .where(
      and(
        eq(autoRosieRuns.tenantId, session.tenant.id),
        eq(autoRosieRuns.undoToken, token),
        isNotNull(autoRosieRuns.diff),
      ),
    )
    .limit(1);
  if (!run) return NextResponse.json({ error: "not found or already undone" }, { status: 404 });

  const diff = run.diff as Record<string, unknown> | null;
  if (!diff) return NextResponse.json({ error: "no diff to undo" }, { status: 400 });

  const result = await undoRunDiff(session.tenant.id, diff);
  if (!result.ok) {
    return NextResponse.json({ error: result.detail ?? "undo failed" }, { status: 400 });
  }

  // Burn the token so undo is one-shot.
  await db
    .update(autoRosieRuns)
    .set({ undoToken: null })
    .where(eq(autoRosieRuns.id, run.id));

  return NextResponse.json({ ok: true });
}
