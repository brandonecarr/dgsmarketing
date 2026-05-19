import { NextResponse } from "next/server";
import { z } from "zod";
import { db, webVitals } from "@rosie/db";

export const runtime = "nodejs";

const Body = z.object({
  metric: z.enum(["LCP", "INP", "CLS", "FCP", "TTFB"]),
  value: z.number().finite().min(0).max(60_000),
  rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
  path: z.string().max(500).optional(),
  deviceType: z.enum(["mobile", "desktop"]).optional(),
  connection: z.string().max(20).optional(),
  tenantId: z.string().uuid().optional(),
});

/**
 * Ingest endpoint for client-reported Web Vitals. Accepts beacon POSTs from
 * the browser via `sendBeacon`, which is fire-and-forget — so we must answer
 * quickly even if the DB hiccups.
 */
export async function POST(req: Request) {
  const text = await req.text().catch(() => "");
  const json = text ? safeJson(text) : null;
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  // CLS comes through as 0.x; persist it as ms*1000 so the table stays integer-only.
  const stored = parsed.data.metric === "CLS"
    ? Math.round(parsed.data.value * 1000)
    : Math.round(parsed.data.value);

  db.insert(webVitals)
    .values({
      tenantId: parsed.data.tenantId,
      metric: parsed.data.metric,
      value: stored,
      rating: parsed.data.rating,
      path: parsed.data.path,
      deviceType: parsed.data.deviceType,
      connection: parsed.data.connection,
    })
    .catch((e) => console.warn("[vitals] insert failed", e));

  return NextResponse.json({ ok: true });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
