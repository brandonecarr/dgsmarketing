import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db, memberships } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ACTIVE_TENANT_COOKIE } from "@/lib/active-tenant";

export const runtime = "nodejs";

const Body = z.object({ tenantId: z.string().uuid() });

export async function POST(req: Request) {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  // Only let users pin a tenant they're actually a member of.
  const [row] = await db
    .select({ tenantId: memberships.tenantId })
    .from(memberships)
    .where(and(eq(memberships.userId, data.user.id), eq(memberships.tenantId, parsed.data.tenantId)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "not a member of that tenant" }, { status: 403 });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, parsed.data.tenantId, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true });
}
