"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "rosie:cookie-consent:v1";

/**
 * Minimal GDPR cookie banner. Shown only when the request was geo-tagged to an
 * EU/EEA/UK region (detected server-side via x-vercel-ip-country). We don't
 * load tracking pixels behind the banner yet — the banner currently exists to
 * satisfy the "informed consent" requirement; pixel-gating will come when the
 * pixel loader gets a consent-aware mode.
 */
export function CookieBanner({ show }: { show: boolean }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!show) return;
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      setDismissed(Boolean(v));
    } catch {
      setDismissed(false);
    }
  }, [show]);

  const accept = (kind: "all" | "necessary") => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ kind, at: new Date().toISOString() }),
      );
    } catch {
      // Ignore — storage blocked.
    }
    setDismissed(true);
  };

  if (!show || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 640,
        margin: "0 auto",
        background: "#0b0b14",
        color: "#fff",
        borderRadius: 12,
        padding: "1rem 1.25rem",
        boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
        fontSize: 13,
        lineHeight: 1.5,
        zIndex: 50,
      }}
    >
      <p style={{ marginBottom: ".75rem" }}>
        We use cookies and similar technologies to measure ad performance and improve this site.
        See our <a href="/legal/privacy" style={{ color: "#fde68a" }}>Privacy Policy</a> for
        details. You can choose what to allow.
      </p>
      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => accept("all")}
          style={{
            background: "#f59e0b",
            color: "#0b0b14",
            border: 0,
            borderRadius: 6,
            padding: ".55rem 1rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Accept all
        </button>
        <button
          type="button"
          onClick={() => accept("necessary")}
          style={{
            background: "transparent",
            color: "#fff",
            border: "1px solid #4b5563",
            borderRadius: 6,
            padding: ".55rem 1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Necessary only
        </button>
      </div>
    </div>
  );
}
