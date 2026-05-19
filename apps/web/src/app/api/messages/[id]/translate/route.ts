import { NextResponse } from "next/server";
import { db, messages } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { translate, primaryLang } from "@rosie/ai";
import { loadActiveSession } from "@/lib/active-tenant";
import { normalizeLocale } from "@/lib/i18n";

export const runtime = "nodejs";

/**
 * Translate a stored message into the tenant's locale (or a query-override
 * target). The result is cached on `messages.translated_body` so repeat
 * loads of the same thread are free.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  const url = new URL(req.url);
  const target = normalizeLocale(url.searchParams.get("to") ?? session.tenant.locale ?? "en-US");

  const [msg] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, id), eq(messages.tenantId, session.tenant.id)))
    .limit(1);
  if (!msg) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Already cached at the same target — short-circuit.
  if (msg.translatedBody && msg.translatedTo === target) {
    return NextResponse.json({ translatedBody: msg.translatedBody, target, cached: true });
  }

  // Source is already in the target language — no work to do.
  if (msg.language && primaryLang(msg.language) === primaryLang(target)) {
    return NextResponse.json({
      translatedBody: msg.body,
      target,
      sameLanguage: true,
    });
  }

  const translated = await translate(msg.body, target);
  await db
    .update(messages)
    .set({ translatedBody: translated, translatedTo: target })
    .where(eq(messages.id, msg.id));

  return NextResponse.json({ translatedBody: translated, target, cached: false });
}
