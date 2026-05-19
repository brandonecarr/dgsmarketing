import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { verifyState } from "@/lib/google/oauth";
import { getAdDriver, isAdPlatform, platformAppConfig } from "@/lib/ads/router";
import { saveAdCreds } from "@/lib/ads/creds";
import { recordAudit } from "@/lib/audit";

async function origin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const url = new URL(req.url);
  const redirectTo = (msg: string) =>
    NextResponse.redirect(`${url.origin}/settings?ads_error=${encodeURIComponent(msg)}`, 302);

  if (!isAdPlatform(platform)) return redirectTo("unknown platform");

  const code = url.searchParams.get("code");
  // TikTok passes the code as `auth_code` instead of `code` and includes `state`.
  const ttCode = url.searchParams.get("auth_code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error")) return redirectTo(url.searchParams.get("error") ?? "denied");
  if ((!code && !ttCode) || !state) return redirectTo("missing code/state");

  const verified = await verifyState(state);
  if (!verified) return redirectTo("invalid state");

  const app = platformAppConfig(platform);
  if (!app) return redirectTo("OAuth app not configured");

  const base = await origin();
  const driver = getAdDriver(platform);
  let tokens;
  try {
    tokens = await driver.exchangeCode({
      code: code ?? ttCode!,
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      redirectUri: `${base}/api/ads/${platform}/callback`,
    });
  } catch (e) {
    return redirectTo(e instanceof Error ? e.message : "exchange failed");
  }

  await saveAdCreds({
    tenantId: verified.tenantId,
    platform,
    creds: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      extras:
        platform === "tiktok"
          ? { appId: app.clientId, secret: app.clientSecret }
          : platform === "google_ads"
            ? { developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN }
            : {},
    },
  });

  await recordAudit({
    tenantId: verified.tenantId,
    action: "integration.connect",
    entityType: "integration",
    entityId: platform,
    summary: `Connected ${platform}`,
    headers: req.headers,
  });

  return NextResponse.redirect(`${url.origin}/settings?ads_connected=${platform}`, 302);
}
