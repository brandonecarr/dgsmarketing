import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { loadActiveSession } from "@/lib/active-tenant";
import { getAdDriver, isAdPlatform, platformAppConfig } from "@/lib/ads/router";
import { issueState } from "@/lib/google/oauth";

async function origin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  if (!isAdPlatform(platform)) {
    return NextResponse.json({ error: "unknown platform" }, { status: 404 });
  }
  const session = await loadActiveSession();
  const app = platformAppConfig(platform);
  if (!app) {
    return NextResponse.json(
      { error: `${platform} OAuth app not configured (set env vars)` },
      { status: 500 },
    );
  }
  const base = await origin();
  const state = await issueState(session.tenant.id);
  const driver = getAdDriver(platform);
  const url = driver.authUrl({
    clientId: app.clientId,
    redirectUri: `${base}/api/ads/${platform}/callback`,
    state,
  });
  return NextResponse.redirect(url, 302);
}
