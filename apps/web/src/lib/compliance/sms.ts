import { db, smsOptOuts } from "@rosie/db";
import { and, eq } from "@rosie/db";

/** Industry-standard TCPA keywords. Case-insensitive whole-word match. */
const STOP_WORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
  "REVOKE",
  "OPTOUT",
  "OPT-OUT",
]);
const HELP_WORDS = new Set(["HELP", "INFO"]);
const START_WORDS = new Set(["START", "UNSTOP", "YES"]);

export type SmsKeywordIntent = "stop" | "help" | "start" | null;

/**
 * Detects TCPA opt-out / help / opt-back-in keywords. Strips whitespace and
 * punctuation so "Stop!" / " STOP " / "stop." all match.
 */
export function detectSmsKeyword(body: string): { intent: SmsKeywordIntent; keyword: string | null } {
  const cleaned = body
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const w of cleaned) {
    if (STOP_WORDS.has(w)) return { intent: "stop", keyword: w };
    if (HELP_WORDS.has(w)) return { intent: "help", keyword: w };
    if (START_WORDS.has(w)) return { intent: "start", keyword: w };
  }
  return { intent: null, keyword: null };
}

/** Returns true if (tenant, phone) is opted out. */
export async function isOptedOut(tenantId: string, phone: string): Promise<boolean> {
  if (!phone) return false;
  const [row] = await db
    .select({ id: smsOptOuts.id })
    .from(smsOptOuts)
    .where(and(eq(smsOptOuts.tenantId, tenantId), eq(smsOptOuts.phone, phone)))
    .limit(1);
  return Boolean(row);
}

export async function recordOptOut(opts: {
  tenantId: string;
  phone: string;
  source: "sms_keyword" | "operator_manual" | "dsar_request" | "bounce" | "complaint";
  keyword?: string;
  notes?: string;
}): Promise<void> {
  try {
    await db
      .insert(smsOptOuts)
      .values({
        tenantId: opts.tenantId,
        phone: opts.phone,
        source: opts.source,
        keyword: opts.keyword,
        notes: opts.notes,
      })
      .onConflictDoNothing();
  } catch (e) {
    console.error("recordOptOut failed", e);
  }
}

export async function removeOptOut(tenantId: string, phone: string): Promise<void> {
  await db
    .delete(smsOptOuts)
    .where(and(eq(smsOptOuts.tenantId, tenantId), eq(smsOptOuts.phone, phone)));
}

/**
 * Standard auto-replies. Tenants can customize via brand profile later;
 * the defaults below are TCPA-acceptable.
 */
export function stopConfirmationText(displayName: string): string {
  return `${displayName}: You're unsubscribed. No more marketing messages will be sent from this number. Reply START to opt back in.`;
}

export function helpReplyText(displayName: string, phone?: string | null): string {
  return `${displayName}: Msg & data rates may apply. Msg frequency varies. Reply STOP to unsubscribe.${
    phone ? ` Support: ${phone}` : ""
  }`;
}

export function startConfirmationText(displayName: string): string {
  return `${displayName}: You've opted back in. Reply STOP to unsubscribe at any time.`;
}

/** The disclosure shown on any web form that captures a phone number for SMS. */
export const TCPA_DISCLOSURE = (displayName: string) =>
  `By providing your phone number you agree to receive marketing SMS from ${displayName}. ` +
  `Consent is not a condition of any purchase. Msg & data rates may apply. ` +
  `Msg frequency varies. Reply STOP to unsubscribe, HELP for help.`;
