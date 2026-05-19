"use client";

import { useEffect } from "react";

/**
 * Applies `dir` + `lang` to <html> when the tenant changes. We do it
 * client-side because the root layout is shared with the marketing pages
 * (which don't know the tenant). Idempotent — re-running on the same locale
 * is a no-op.
 */
export function LocaleDirectionEffect({ locale, dir }: { locale: string; dir: "ltr" | "rtl" }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
  }, [locale, dir]);
  return null;
}
