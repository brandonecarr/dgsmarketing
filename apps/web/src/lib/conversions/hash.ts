import { createHash } from "node:crypto";

/**
 * Meta CAPI / Google Enhanced Conversions / TikTok all require SHA-256 of
 * normalized identifiers. The normalization rules are slightly different
 * per platform; these helpers cover the intersection.
 */
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function hashEmail(email: string | null | undefined): string | undefined {
  if (!email) return undefined;
  return sha256(email.trim().toLowerCase());
}

export function hashPhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  // E.164 without the '+' for Meta; TikTok wants the same format.
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  return sha256(digits);
}

export function hashName(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  return sha256(name.trim().toLowerCase());
}
