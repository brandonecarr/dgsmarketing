/**
 * Locale-aware formatting. Every render path that shows a date/number to
 * an operator should funnel through here so the tenant's `locale` and
 * `timezone` are applied consistently. Pure helpers — no React, no fetch.
 */

const RTL_LANGS = new Set(["ar", "fa", "he", "iw", "ur", "ps", "yi", "dv"]);

export function isRtlLocale(locale: string | null | undefined): boolean {
  if (!locale) return false;
  const lang = locale.split("-")[0]!.toLowerCase();
  return RTL_LANGS.has(lang);
}

export function formatDate(
  value: Date | string | number,
  opts: { locale?: string; timezone?: string; style?: "short" | "medium" | "long" } = {},
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const dateStyle = opts.style ?? "medium";
  return new Intl.DateTimeFormat(opts.locale ?? "en-US", {
    dateStyle,
    timeZone: opts.timezone,
  }).format(d);
}

export function formatDateTime(
  value: Date | string | number,
  opts: { locale?: string; timezone?: string } = {},
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(opts.locale ?? "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: opts.timezone,
  }).format(d);
}

export function formatNumber(
  value: number,
  opts: { locale?: string; decimals?: number } = {},
): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(opts.locale ?? "en-US", {
    maximumFractionDigits: opts.decimals ?? 0,
  }).format(value);
}

export function formatCurrency(
  value: number,
  opts: { locale?: string; currency?: string } = {},
): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(opts.locale ?? "en-US", {
    style: "currency",
    currency: opts.currency ?? defaultCurrencyForLocale(opts.locale ?? "en-US"),
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Best-effort ISO 4217 default from a BCP-47 locale region. Operators can
 * override per-tenant via business profile if they want a different currency.
 */
function defaultCurrencyForLocale(locale: string): string {
  const region = locale.split("-")[1]?.toUpperCase();
  const map: Record<string, string> = {
    US: "USD",
    CA: "CAD",
    MX: "MXN",
    GB: "GBP",
    AU: "AUD",
    NZ: "NZD",
    IE: "EUR",
    DE: "EUR",
    FR: "EUR",
    ES: "EUR",
    IT: "EUR",
    NL: "EUR",
    PT: "EUR",
    AT: "EUR",
    BE: "EUR",
    FI: "EUR",
    GR: "EUR",
    JP: "JPY",
    IN: "INR",
    BR: "BRL",
    AR: "ARS",
    CL: "CLP",
    CO: "COP",
    ZA: "ZAR",
    NG: "NGN",
    EG: "EGP",
    AE: "AED",
    SA: "SAR",
    IL: "ILS",
    SE: "SEK",
    NO: "NOK",
    DK: "DKK",
    CH: "CHF",
    PL: "PLN",
    CZ: "CZK",
    KR: "KRW",
    CN: "CNY",
    HK: "HKD",
    TW: "TWD",
    SG: "SGD",
    PH: "PHP",
    TH: "THB",
    VN: "VND",
    ID: "IDR",
    MY: "MYR",
    TR: "TRY",
  };
  return region && map[region] ? map[region] : "USD";
}

/**
 * Display name of a locale in itself: "es-MX" → "español (México)".
 * Falls back gracefully when the runtime doesn't recognize the tag.
 */
export function localeDisplayName(locale: string): string {
  try {
    const dn = new Intl.DisplayNames([locale], { type: "language" });
    const langName = dn.of(locale.split("-")[0]!) ?? locale;
    const region = locale.split("-")[1];
    if (!region) return langName;
    const regionDn = new Intl.DisplayNames([locale], { type: "region" });
    return `${langName} (${regionDn.of(region) ?? region})`;
  } catch {
    return locale;
  }
}

/**
 * The set of locales we surface in pickers + recommend tenants choose from.
 * Add to this list as you grow; falling back is graceful — any BCP-47 tag
 * will format correctly even if it isn't here.
 */
export const SUPPORTED_LOCALES: readonly string[] = [
  "en-US",
  "en-GB",
  "en-CA",
  "en-AU",
  "es-US",
  "es-MX",
  "es-ES",
  "es-AR",
  "fr-FR",
  "fr-CA",
  "de-DE",
  "it-IT",
  "pt-PT",
  "pt-BR",
  "nl-NL",
  "ja-JP",
  "ko-KR",
  "zh-CN",
  "zh-TW",
  "ar-SA",
  "he-IL",
  "tr-TR",
];

/**
 * BCP-47 normalization. Lower-cases the language, upper-cases the region.
 * "EN_us" → "en-US"; "en" → "en".
 */
export function normalizeLocale(input: string): string {
  const parts = input.replace("_", "-").split("-");
  const lang = parts[0]?.toLowerCase() ?? "";
  const region = parts[1]?.toUpperCase();
  return region ? `${lang}-${region}` : lang;
}
