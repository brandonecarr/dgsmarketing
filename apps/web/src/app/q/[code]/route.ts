import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db, qrCodes, trackingClicks, sql } from "@rosie/db";
import { pushTrackingClick } from "@/lib/tinybird";
import { eq } from "@rosie/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fingerprint(ip: string | null, ua: string | null): string {
  const h = createHash("sha256");
  h.update(`${ip ?? ""}::${ua ?? ""}`);
  return h.digest("hex").slice(0, 32);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const rows = await db
    .select({
      id: qrCodes.id,
      tenantId: qrCodes.tenantId,
      destinationUrl: qrCodes.destinationUrl,
    })
    .from(qrCodes)
    .where(eq(qrCodes.code, code))
    .limit(1);

  const qr = rows[0];
  if (!qr) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const ua = req.headers.get("user-agent");
  const referer = req.headers.get("referer");
  const country = req.headers.get("x-vercel-ip-country") ?? null;

  const fp = fingerprint(ip, ua);

  // Dual-write: Postgres for transactional truth, Tinybird for scale-out reads.
  // Best-effort — never block the redirect on logging.
  Promise.all([
    db.insert(trackingClicks).values({
      tenantId: qr.tenantId,
      qrCodeId: qr.id,
      fingerprint: fp,
      referer: referer ?? undefined,
      userAgent: ua ?? undefined,
      country: country ?? undefined,
    }),
    db
      .update(qrCodes)
      .set({
        scanCount: sql`${qrCodes.scanCount} + 1`,
        lastScanAt: new Date(),
      })
      .where(eq(qrCodes.id, qr.id)),
    pushTrackingClick({
      tenant_id: qr.tenantId,
      qr_code_id: qr.id,
      fingerprint: fp,
      country: country ?? null,
    }),
  ]).catch((err) => console.error("qr scan log failed", err));

  return NextResponse.redirect(qr.destinationUrl, 302);
}
