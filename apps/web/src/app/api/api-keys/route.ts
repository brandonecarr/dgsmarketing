import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db, apiKeys } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { recordAudit } from "@/lib/audit";

const Body = z.object({
  name: z.string().min(1).max(120),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

export const runtime = "nodejs";

export async function GET() {
  const session = await loadActiveSession();
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, session.tenant.id))
    .orderBy(desc(apiKeys.createdAt));
  return NextResponse.json({ keys: rows });
}

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const raw = "rosie_" + randomBytes(24).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 12);
  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [row] = await db
    .insert(apiKeys)
    .values({
      tenantId: session.tenant.id,
      createdByUserId: session.user.id,
      name: parsed.data.name,
      prefix,
      keyHash: hash,
      expiresAt,
    })
    .returning({ id: apiKeys.id, prefix: apiKeys.prefix, expiresAt: apiKeys.expiresAt });

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "api_key.create",
    entityType: "api_key",
    entityId: row?.id,
    summary: `Created API key "${parsed.data.name}" (${prefix}…)`,
    payload: { name: parsed.data.name, prefix },
    headers: req.headers,
  });

  // The plaintext is only ever returned once, here.
  return NextResponse.json({
    ok: true,
    key: { ...row, secret: raw },
  });
}
