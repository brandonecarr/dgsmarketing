"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Card, CardBody, CardHeader } from "@rosie/ui";

type Mode = "chat" | "text" | "review";

const TABS: Array<{ id: Mode; label: string; desc: string }> = [
  {
    id: "chat",
    label: "Chat",
    desc: "Floating button + lead-capture form. POSTs straight into the Rosie inbox.",
  },
  {
    id: "text",
    label: "Click-to-text",
    desc: "Opens the visitor's SMS app pre-filled with a message to your number.",
  },
  {
    id: "review",
    label: "Review request",
    desc: "Star prompt that routes 4–5★ to Google and ≤3★ into a private feedback form.",
  },
];

export function EmbedCard({
  tenantSlug,
  baseUrl,
  smsNumber,
  reviewUrl,
}: {
  tenantSlug: string;
  baseUrl: string;
  smsNumber: string | null;
  reviewUrl: string | null;
}) {
  const [active, setActive] = useState<Mode>("chat");
  const [copied, setCopied] = useState(false);

  const snippet = `<script async src="${baseUrl}/widget.js"
        data-rosie-tenant="${tenantSlug}"
        data-rosie-mode="${active}"></script>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Permissions denied — fall back to alert.
      window.prompt("Copy this snippet:", snippet);
    }
  }

  const missing =
    (active === "text" && !smsNumber) || (active === "review" && !reviewUrl);

  return (
    <Card id="embed">
      <CardHeader>
        <h3 className="text-base font-semibold">Embed widgets</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Drop one line of code on the operator's marketing site to surface a Rosie-powered
          widget. CORS is open on /api/webhooks/leads/{tenantSlug} so any origin can submit.
        </p>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={
                "rounded-full border px-3 py-1 text-xs font-semibold transition " +
                (t.id === active
                  ? "border-rosie-600 bg-rosie-50 text-rosie-700 dark:bg-rosie-950 dark:text-rosie-200"
                  : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {TABS.find((t) => t.id === active)?.desc}
        </p>

        {missing ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            {active === "text"
              ? "Set a SMS number in Branding to enable this widget."
              : "Set a Review URL in Branding to enable this widget."}
          </div>
        ) : null}

        <div className="relative">
          <pre className="overflow-x-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-[11px] leading-relaxed">
            <code>{snippet}</code>
          </pre>
          <button
            onClick={copy}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-[10px] font-semibold hover:bg-[hsl(var(--muted))]"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-[11px] text-[hsl(var(--muted-foreground))]">
          Optional attributes:
          <ul className="mt-1 ml-4 list-disc">
            <li>
              <code className="font-mono">data-rosie-color=&quot;#ff5722&quot;</code> — override the
              button color
            </li>
            <li>
              <code className="font-mono">data-rosie-label=&quot;Get a quote&quot;</code> — override
              the button text
            </li>
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}
