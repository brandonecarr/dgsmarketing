import { NextResponse } from "next/server";
import { z } from "zod";
import { db, integrations } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { loadActiveSession } from "@/lib/active-tenant";

export const runtime = "nodejs";

const FB_BASE = "https://graph.facebook.com/v18.0";

interface MetaStored {
  accessToken?: string;
  pageId?: string;
  pageAccessToken?: string;
  igUserId?: string;
}

/**
 * Lists the Facebook Pages the connected Meta user can post to + the IG Business
 * Account linked to each (if any). Used by the Settings publishing card.
 */
export async function GET() {
  const session = await loadActiveSession();
  const [row] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.tenantId, session.tenant.id), eq(integrations.provider, "meta")))
    .limit(1);
  if (!row?.secrets) return NextResponse.json({ error: "Meta not connected" }, { status: 412 });
  const stored = decryptJson<MetaStored>(row.secrets);
  if (!stored?.accessToken) return NextResponse.json({ error: "Meta token missing" }, { status: 412 });

  const res = await fetch(
    `${FB_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(stored.accessToken)}`,
  );
  if (!res.ok) {
    return NextResponse.json({ error: `Meta /me/accounts ${res.status}: ${await res.text()}` }, { status: 502 });
  }
  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string };
    }>;
  };

  return NextResponse.json({
    pages: (json.data ?? []).map((p) => ({
      id: p.id,
      name: p.name ?? null,
      igUserId: p.instagram_business_account?.id ?? null,
    })),
    selected: { pageId: stored.pageId ?? null, igUserId: stored.igUserId ?? null },
  });
}

const SelectBody = z.object({
  pageId: z.string().min(1).max(40),
});

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = SelectBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const [row] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.tenantId, session.tenant.id), eq(integrations.provider, "meta")))
    .limit(1);
  if (!row?.secrets) return NextResponse.json({ error: "Meta not connected" }, { status: 412 });
  const stored = decryptJson<MetaStored>(row.secrets);
  if (!stored?.accessToken) return NextResponse.json({ error: "Meta token missing" }, { status: 412 });

  // Re-fetch pages to capture the selected page's access token + IG account.
  const res = await fetch(
    `${FB_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(stored.accessToken)}`,
  );
  if (!res.ok) return NextResponse.json({ error: `Meta /me/accounts ${res.status}` }, { status: 502 });
  const json = (await res.json()) as {
    data?: Array<{ id: string; access_token?: string; instagram_business_account?: { id?: string } }>;
  };
  const page = json.data?.find((p) => p.id === parsed.data.pageId);
  if (!page) return NextResponse.json({ error: "page not found in your account list" }, { status: 404 });

  const next: MetaStored = {
    ...stored,
    pageId: page.id,
    pageAccessToken: page.access_token ?? stored.pageAccessToken,
    igUserId: page.instagram_business_account?.id ?? stored.igUserId,
  };
  await db
    .update(integrations)
    .set({ secrets: encryptJson(next) as unknown as Record<string, unknown>, updatedAt: new Date() })
    .where(eq(integrations.id, row.id));

  return NextResponse.json({
    ok: true,
    pageId: next.pageId,
    igUserId: next.igUserId ?? null,
  });
}
