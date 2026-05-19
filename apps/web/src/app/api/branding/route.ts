import { NextResponse } from "next/server";
import { z } from "zod";
import { db, tenants } from "@rosie/db";
import { eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { recordAudit } from "@/lib/audit";
import { normalizeLocale } from "@/lib/i18n";

const Theme = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sidebarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  logoUrl: z.string().url().optional(),
  displayName: z.string().max(120).optional(),
  assistantName: z.string().max(40).optional(),
  hidePoweredBy: z.boolean().optional(),
  smsNumber: z.string().min(7).max(30).optional(),
  reviewUrl: z.string().url().optional(),
  timezone: z.string().max(64).optional(),
  locale: z.string().max(20).optional(),
});

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  const session = await loadActiveSession();
  const parsed = Theme.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const { timezone, locale, ...themePatch } = parsed.data;
  if (timezone && !isValidTimezone(timezone)) {
    return NextResponse.json({ error: `Unknown timezone: ${timezone}` }, { status: 400 });
  }
  const nextTheme = { ...(session.tenant.brandTheme ?? {}), ...themePatch };

  const update: {
    brandTheme: typeof nextTheme;
    updatedAt: Date;
    timezone?: string;
    locale?: string;
  } = { brandTheme: nextTheme, updatedAt: new Date() };
  if (timezone) update.timezone = timezone;
  if (locale) update.locale = normalizeLocale(locale);

  await db.update(tenants).set(update).where(eq(tenants.id, session.tenant.id));
  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "branding.update",
    entityType: "tenant",
    entityId: session.tenant.id,
    summary: timezone ? `Updated branding (timezone → ${timezone})` : "Updated branding",
    payload: parsed.data,
    headers: req.headers,
  });
  return NextResponse.json({ ok: true, brandTheme: nextTheme, timezone, locale });
}
