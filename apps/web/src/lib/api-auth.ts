import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db, apiKeys, type ApiScope } from "@rosie/db";
import { and, eq, isNull } from "@rosie/db";
import { checkRateLimit } from "./rate-limit";

/**
 * Default scope set for keys created before Phase 20 (when scopes were
 * nullable). Keeps existing keys working without forcing a re-grant.
 */
const LEGACY_DEFAULT_SCOPES: ApiScope[] = [
  "leads:read",
  "leads:write",
  "conversations:read",
  "conversations:write",
];

export interface ApiSession {
  tenantId: string;
  keyId: string;
  scopes: ApiScope[];
}

export class ApiAuthError extends Error {
  constructor(
    message: string,
    public readonly status = 401,
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

/**
 * Authenticates a public-API request via `Authorization: Bearer rosie_<key>`.
 * Throws on failure (caught and translated by the route handler).
 *
 * Pass `requiredScope` to enforce a per-endpoint scope check — surface a 403
 * with a useful error when the key isn't authorized for what it asked for.
 */
export async function authenticateApiRequest(
  req: Request,
  requiredScope?: ApiScope,
): Promise<ApiSession> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(rosie_[A-Za-z0-9]+)$/);
  if (!match || !match[1]) {
    throw new ApiAuthError("Missing or malformed Authorization header. Use 'Bearer rosie_<key>'.");
  }
  const presented = match[1];
  const hash = createHash("sha256").update(presented).digest("hex");

  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!row) throw new ApiAuthError("Invalid API key");

  if (row.expiresAt && row.expiresAt < new Date()) {
    throw new ApiAuthError("API key expired");
  }

  // Per-key rate limit. 60 req/min by default; tier knobs in rate-limit.ts.
  const rl = await checkRateLimit({ tier: "api_v1", identifier: `key:${row.id}` });
  if (!rl.ok) {
    throw new ApiAuthError(rl.reason ?? "Too many requests", 429);
  }

  const scopes: ApiScope[] =
    row.scopes && row.scopes.length > 0 ? (row.scopes as ApiScope[]) : LEGACY_DEFAULT_SCOPES;

  if (requiredScope && !scopes.includes(requiredScope)) {
    throw new ApiAuthError(
      `This key is not authorized for scope "${requiredScope}". Grant it under Settings → API keys.`,
      403,
    );
  }

  // Bump last-used; non-blocking.
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch((e) => console.error("api key last_used update failed", e));

  return { tenantId: row.tenantId, keyId: row.id, scopes };
}

export function apiErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json(
    { error: err instanceof Error ? err.message : "unknown error" },
    { status: 500 },
  );
}
