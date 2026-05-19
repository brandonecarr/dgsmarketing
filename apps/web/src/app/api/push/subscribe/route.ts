import { NextResponse } from "next/server";
import { z } from "zod";
import { db, pushSubscriptions } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

export const runtime = "nodejs";

const Body = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  userAgent: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const { endpoint, keys, userAgent } = parsed.data;

  // Upsert: same endpoint posting again should just update keys + last_seen.
  await db
    .insert(pushSubscriptions)
    .values({
      tenantId: session.tenant.id,
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? req.headers.get("user-agent") ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        tenantId: session.tenant.id,
        userId: session.user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        lastSeenAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}

const DeleteBody = z.object({ endpoint: z.string().url() });

export async function DELETE(req: Request) {
  const session = await loadActiveSession();
  const parsed = DeleteBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.tenantId, session.tenant.id),
        eq(pushSubscriptions.endpoint, parsed.data.endpoint),
      ),
    );
  return NextResponse.json({ ok: true });
}
