import { NextResponse } from "next/server";
import { db, tenants } from "@rosie/db";
import { eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { uploadPublic } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);

/**
 * Logo upload. Multipart-form posts a single `file`. Writes to Storage at
 * `branding/<tenantId>/logo.<ext>` (upserted), then patches `brandTheme.logoUrl`
 * to the public URL. Returns the URL so the client can swap the <img> immediately.
 */
export async function POST(req: Request) {
  const session = await loadActiveSession();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (max 2 MB)" }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "must be PNG, JPEG, SVG, or WebP" }, { status: 415 });
  }

  const ext =
    file.type === "image/png" ? "png" :
    file.type === "image/jpeg" ? "jpg" :
    file.type === "image/svg+xml" ? "svg" :
    "webp";
  const buf = Buffer.from(await file.arrayBuffer());
  // Cache-bust the URL on every upload so browsers don't show the old logo.
  const path = `${session.tenant.id}/logo-${Date.now()}.${ext}`;
  const { publicUrl } = await uploadPublic("branding", path, buf, file.type);

  const nextTheme = { ...(session.tenant.brandTheme ?? {}), logoUrl: publicUrl };
  await db
    .update(tenants)
    .set({ brandTheme: nextTheme, updatedAt: new Date() })
    .where(eq(tenants.id, session.tenant.id));

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "branding.update",
    entityType: "tenant",
    entityId: session.tenant.id,
    summary: "Uploaded logo",
    payload: { logoUrl: publicUrl, size: file.size, contentType: file.type },
    headers: req.headers,
  });

  return NextResponse.json({ ok: true, logoUrl: publicUrl });
}
