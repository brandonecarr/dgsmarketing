"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Captures Core Web Vitals (LCP, INP, CLS) + paint metrics (FCP, TTFB) and
 * ships them to /api/perf/vitals via `sendBeacon` so the request goes out
 * even during page unload.
 */
export function WebVitalsReporter({ tenantId }: { tenantId?: string }) {
  useReportWebVitals((metric) => {
    if (typeof navigator === "undefined") return;
    // Only emit the five standard metrics.
    const accepted = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);
    if (!accepted.has(metric.name)) return;

    const payload = {
      metric: metric.name,
      value: metric.value,
      rating: (metric as { rating?: "good" | "needs-improvement" | "poor" }).rating,
      path: window.location.pathname,
      deviceType: matchMobile() ? "mobile" : "desktop",
      connection:
        (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
          ?.effectiveType ?? undefined,
      tenantId,
    };

    const body = JSON.stringify(payload);
    const url = "/api/perf/vitals";

    // sendBeacon survives page unload; fetch with keepalive is the fallback.
    if ("sendBeacon" in navigator) {
      try {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
        return;
      } catch {
        // Fall through.
      }
    }
    fetch(url, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(
      () => {},
    );
  });
  return null;
}

function matchMobile() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(max-width: 768px)").matches ?? false;
}
