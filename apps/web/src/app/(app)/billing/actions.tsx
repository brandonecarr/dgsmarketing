"use client";

import { useState } from "react";
import { Button } from "@rosie/ui";

export function BillingActions({ hasCustomer }: { hasCustomer: boolean }) {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);

  async function checkout() {
    setLoading("checkout");
    try {
      const r = await fetch("/api/billing/checkout", { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.url) {
        alert(j.error ?? "Checkout failed");
        return;
      }
      window.location.href = j.url;
    } finally {
      setLoading(null);
    }
  }

  async function portal() {
    setLoading("portal");
    try {
      const r = await fetch("/api/billing/portal", { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.url) {
        alert(j.error ?? "Portal failed");
        return;
      }
      window.location.href = j.url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button onClick={checkout} disabled={loading !== null}>
        {loading === "checkout" ? "Loading…" : hasCustomer ? "Change plan" : "Start subscription"}
      </Button>
      {hasCustomer ? (
        <Button variant="outline" onClick={portal} disabled={loading !== null}>
          {loading === "portal" ? "Loading…" : "Open Stripe portal"}
        </Button>
      ) : null}
    </div>
  );
}
