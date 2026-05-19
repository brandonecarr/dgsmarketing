import { NextResponse } from "next/server";
import { processDueCadenceRuns } from "@/lib/cadences/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await processDueCadenceRuns();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return POST(req);
}
