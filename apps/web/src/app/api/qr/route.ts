import { NextResponse } from "next/server";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import QRCode from "qrcode";
import { db, qrCodes } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { uploadPublic } from "@/lib/supabase/admin";
import { headers } from "next/headers";

const Body = z.object({
  name: z.string().min(1).max(120),
  destinationUrl: z.string().url(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  frameText: z.string().max(80).optional(),
});

const nano = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789", 10);

async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;
  const base = await getBaseUrl();

  // 1. Insert row to claim a unique short code.
  let code = nano();
  // Retry up to 5x on conflict (extremely unlikely with 56^10).
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const trackingUrl = `${base}/q/${code}`;
      const png = await QRCode.toBuffer(trackingUrl, {
        type: "png",
        errorCorrectionLevel: "H",
        margin: 2,
        width: 600,
        color: {
          dark: input.color ?? "#0b0b14",
          light: input.background ?? "#ffffff",
        },
      });
      const storagePath = `${session.tenant.id}/${code}.png`;
      const uploaded = await uploadPublic("qr", storagePath, png, "image/png");

      const [row] = await db
        .insert(qrCodes)
        .values({
          tenantId: session.tenant.id,
          createdByUserId: session.user.id,
          code,
          name: input.name,
          destinationUrl: input.destinationUrl,
          style: {
            color: input.color,
            background: input.background,
            frameText: input.frameText,
          },
          storagePath: uploaded.path,
        })
        .returning();

      return NextResponse.json({
        ok: true,
        qr: {
          ...row,
          trackingUrl,
          pngUrl: uploaded.publicUrl,
        },
      });
    } catch (e) {
      lastError = e;
      code = nano();
      continue;
    }
  }

  return NextResponse.json(
    {
      error: lastError instanceof Error ? lastError.message : "could not create QR code",
    },
    { status: 500 },
  );
}
