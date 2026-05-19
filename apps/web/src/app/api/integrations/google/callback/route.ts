import { NextResponse } from "next/server";
import { db, integrations } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { exchangeCodeForTokens, getBaseUrl, verifyState } from "@/lib/google/oauth";
import { decryptJson, encryptJson } from "@/lib/crypto";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${url.origin}/gbp?error=${encodeURIComponent(oauthError)}`, 302);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${url.origin}/gbp?error=missing_code`, 302);
  }

  const verified = await verifyState(state);
  if (!verified) {
    return NextResponse.redirect(`${url.origin}/gbp?error=invalid_state`, 302);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${url.origin}/gbp?error=google_not_configured`, 302);
  }

  const base = await getBaseUrl();
  let tokens;
  try {
    tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri: `${base}/api/integrations/google/callback`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "exchange_failed";
    return NextResponse.redirect(`${url.origin}/gbp?error=${encodeURIComponent(msg)}`, 302);
  }

  const existing = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, verified.tenantId),
        eq(integrations.provider, "google"),
      ),
    )
    .limit(1);

  const existingSecrets = existing[0]?.secrets
    ? decryptJson<{ refreshToken?: string }>(existing[0].secrets)
    : null;
  const secretBlob = encryptJson({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? existingSecrets?.refreshToken ?? undefined,
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
  });

  if (existing[0]) {
    await db
      .update(integrations)
      .set({
        status: "connected",
        secrets: secretBlob as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, existing[0].id));
  } else {
    await db.insert(integrations).values({
      tenantId: verified.tenantId,
      provider: "google",
      status: "connected",
      secrets: secretBlob as unknown as Record<string, unknown>,
    });
  }

  return NextResponse.redirect(`${url.origin}/gbp?connected=1`, 302);
}
