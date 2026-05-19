import { headers, cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/business.manage",
];

const STATE_COOKIE = "rosie-google-oauth";

export async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function buildAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
}) {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: (opts.scopes ?? GOOGLE_SCOPES).join(" "),
    state: opts.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Returns a state string that encodes the tenant + a CSRF nonce.
 * The nonce is hashed into a cookie; the callback compares them.
 */
export async function issueState(tenantId: string): Promise<string> {
  const nonce = randomBytes(24).toString("base64url");
  const hash = createHash("sha256").update(nonce).digest("base64url");
  const cookieJar = await cookies();
  cookieJar.set(STATE_COOKIE, hash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return `${tenantId}.${nonce}`;
}

export async function verifyState(state: string): Promise<{ tenantId: string } | null> {
  const [tenantId, nonce] = state.split(".");
  if (!tenantId || !nonce) return null;
  const expectedHash = createHash("sha256").update(nonce).digest("base64url");
  const cookieJar = await cookies();
  const cookieValue = cookieJar.get(STATE_COOKIE)?.value;
  cookieJar.delete(STATE_COOKIE);
  if (cookieValue !== expectedHash) return null;
  return { tenantId };
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  scope: string;
  idToken?: string;
}

export async function exchangeCodeForTokens(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    id_token?: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
    idToken: data.id_token,
  };
}

export async function refreshAccessToken(opts: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<Pick<GoogleTokens, "accessToken" | "expiresAt" | "scope">> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: opts.refreshToken,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope: string;
  };
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };
}
