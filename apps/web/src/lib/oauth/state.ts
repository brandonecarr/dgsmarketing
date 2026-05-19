import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";

/**
 * Generic OAuth CSRF state helper. Each provider passes a unique `key` so
 * concurrent connect flows (eg Google + Meta in two tabs) don't clobber each
 * other's cookies.
 *
 * The state string is `<tenantId>.<nonce>`. The nonce hash is stored in a
 * cookie keyed by provider; the callback re-computes the hash and compares.
 */
function cookieName(key: string) {
  return `rosie-oauth-${key.replace(/[^a-z0-9_-]/gi, "")}`;
}

export async function issueOAuthState(key: string, tenantId: string): Promise<string> {
  const nonce = randomBytes(24).toString("base64url");
  const hash = createHash("sha256").update(nonce).digest("base64url");
  const jar = await cookies();
  jar.set(cookieName(key), hash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return `${tenantId}.${nonce}`;
}

export async function verifyOAuthState(
  key: string,
  state: string,
): Promise<{ tenantId: string } | null> {
  const [tenantId, nonce] = state.split(".");
  if (!tenantId || !nonce) return null;
  const expected = createHash("sha256").update(nonce).digest("base64url");
  const jar = await cookies();
  const stored = jar.get(cookieName(key))?.value;
  jar.delete(cookieName(key));
  if (stored !== expected) return null;
  return { tenantId };
}
