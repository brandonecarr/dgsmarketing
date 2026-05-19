import { NextResponse } from "next/server";
import { db, competitors } from "@rosie/db";
import { asc, lt, or, isNull } from "@rosie/db";
import { scanCompetitor } from "@/lib/competitors/scan";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Daily cron that scans every competitor that hasn't been scanned in the last
 * 23 hours. Auth: `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000);
  const due = await db
    .select()
    .from(competitors)
    .where(or(isNull(competitors.lastScanAt), lt(competitors.lastScanAt, cutoff)))
    .orderBy(asc(competitors.lastScanAt))
    .limit(50);

  const results = [];
  for (const c of due) {
    try {
      const r = await scanCompetitor({ tenantId: c.tenantId, competitor: c });
      results.push({ competitorId: r.competitorId, emitted: r.emitted, reason: r.reason });
    } catch (e) {
      results.push({
        competitorId: c.id,
        emitted: 0,
        reason: e instanceof Error ? e.message : "error",
      });
    }
  }

  return NextResponse.json({ ok: true, scanned: due.length, results });
}

export async function GET(req: Request) {
  return POST(req);
}
