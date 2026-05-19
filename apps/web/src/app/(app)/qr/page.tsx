import { db, qrCodes } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { headers } from "next/headers";
import { loadActiveSession } from "@/lib/active-tenant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { QrStudio } from "./studio";

async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function QrPage() {
  const session = await loadActiveSession();
  const base = await getBaseUrl();

  const rows = await db
    .select()
    .from(qrCodes)
    .where(eq(qrCodes.tenantId, session.tenant.id))
    .orderBy(desc(qrCodes.createdAt))
    .limit(30);

  const admin = getSupabaseAdmin();
  const enriched = rows.map((r) => {
    const pngUrl = r.storagePath
      ? admin.storage.from("qr").getPublicUrl(r.storagePath).data.publicUrl
      : null;
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      destinationUrl: r.destinationUrl,
      scanCount: r.scanCount,
      lastScanAt: r.lastScanAt ? r.lastScanAt.toISOString() : null,
      trackingUrl: `${base}/q/${r.code}`,
      pngUrl,
    };
  });

  return <QrStudio recent={enriched} />;
}
