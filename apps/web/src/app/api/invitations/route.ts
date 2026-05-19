import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { db, invitations, memberships, users } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { sendEmail } from "@/lib/email";
import { recordAudit } from "@/lib/audit";

const Body = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "operator", "staff", "client"]).default("operator"),
});

async function originUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const runtime = "nodejs";

export async function GET() {
  const session = await loadActiveSession();
  const rows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      revokedAt: invitations.revokedAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(eq(invitations.tenantId, session.tenant.id));
  return NextResponse.json({ invitations: rows });
}

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  if (session.role !== "owner" && session.role !== "operator") {
    return NextResponse.json({ error: "permission denied" }, { status: 403 });
  }

  // Reject if the email already belongs to a member.
  const [existingMember] = await db
    .select({ id: users.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.tenantId, session.tenant.id), eq(users.email, parsed.data.email)))
    .limit(1);
  if (existingMember) {
    return NextResponse.json({ error: "already a member" }, { status: 409 });
  }

  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(invitations)
    .values({
      tenantId: session.tenant.id,
      email: parsed.data.email,
      role: parsed.data.role,
      tokenHash,
      invitedByUserId: session.user.id,
      expiresAt,
    })
    .returning({ id: invitations.id });

  const base = await originUrl();
  const acceptUrl = `${base}/invite/${token}`;

  const brand = {
    primary: session.tenant.brandTheme?.primaryColor,
    displayName: session.tenant.brandTheme?.displayName ?? session.tenant.name,
    hidePoweredBy: session.tenant.brandTheme?.hidePoweredBy,
  };
  await sendEmail({
    to: parsed.data.email,
    subject: `${brand.displayName} invited you to Rosie`,
    html: `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Inter,sans-serif;padding:24px"><h1 style="font-size:20px">Join ${brand.displayName} on Rosie</h1><p>You've been invited as <strong>${parsed.data.role}</strong>.</p><p style="margin:24px 0"><a href="${acceptUrl}" style="display:inline-block;background:${brand.primary ?? "#5b21b6"};color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Accept invitation</a></p><p style="color:#71717a;font-size:12px">This link expires in 7 days.</p></body></html>`,
    text: `${brand.displayName} invited you to Rosie. Accept: ${acceptUrl}`,
    tags: [{ name: "kind", value: "invitation" }],
  });

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "member.invite",
    entityType: "invitation",
    entityId: row?.id,
    summary: `Invited ${parsed.data.email} as ${parsed.data.role}`,
    payload: { email: parsed.data.email, role: parsed.data.role },
    headers: req.headers,
  });

  return NextResponse.json({ ok: true, invitationId: row?.id, acceptUrl });
}
