"use client";

import { useState } from "react";
import { Megaphone, Sparkles } from "lucide-react";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";

const TEMPLATES = [
  { value: "promo", label: "Promo campaign", description: "Time-bound offer with a promo code." },
  { value: "seasonal", label: "Seasonal kickoff", description: "Seasonal service start with a CTA." },
  { value: "review_drive", label: "Review drive", description: "Won customers → Google review page." },
  { value: "new_service", label: "New service launch", description: "First-week pricing on a new offering." },
] as const;

interface Result {
  postId?: string;
  landingPageId?: string;
  landingSlug?: string;
  qrCodeId?: string | null;
  bulkMessageId?: string;
}

export function LaunchView({ tenantName }: { tenantName: string }) {
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]["value"]>("promo");
  const [topic, setTopic] = useState("");
  const [bulkBody, setBulkBody] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function launch() {
    setRunning(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/quick-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          topic: topic || undefined,
          bulkBody: bulkBody || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error ?? "Launch failed");
        return;
      }
      setResult(j.artifacts);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">Pick a template</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTemplate(t.value)}
                className={cn(
                  "rounded-md border px-3 py-3 text-left transition",
                  template === t.value
                    ? "border-rosie-600 bg-rosie-50 dark:bg-rosie-950"
                    : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]",
                )}
              >
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                  {t.description}
                </div>
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Topic (optional)
            </span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={`Specific angle for ${tenantName}'s campaign`}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              SMS body (optional)
            </span>
            <textarea
              rows={2}
              value={bulkBody}
              onChange={(e) => setBulkBody(e.target.value)}
              placeholder="Leave blank for Rosie's default for this template"
              className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
            />
          </label>

          <Button onClick={launch} disabled={running}>
            <Sparkles className="h-4 w-4" /> {running ? "Launching…" : "Quick Launch"}
          </Button>

          {err ? (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
              {err}
            </div>
          ) : null}
        </CardBody>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Ready for review</h3>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2 text-sm">
              <li>
                ✅ <strong>Facebook post draft</strong> —{" "}
                <a href="/posts" className="underline text-rosie-700">
                  open in Post Scheduler
                </a>
              </li>
              <li>
                ✅ <strong>Landing page draft</strong> —{" "}
                <a
                  href={`/site/${result.landingPageId}`}
                  className="underline text-rosie-700"
                >
                  edit
                </a>
                {result.landingSlug ? (
                  <span className="ml-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                    /p/{result.landingSlug}
                  </span>
                ) : null}
              </li>
              <li>
                {result.qrCodeId ? "✅" : "⚠️"} <strong>Tracked QR code</strong> —{" "}
                <a href="/qr" className="underline text-rosie-700">
                  open QR Studio
                </a>
              </li>
              <li>
                ✅ <strong>SMS blast draft</strong> —{" "}
                <a href="/bulk" className="underline text-rosie-700">
                  review &amp; send in Bulk Messages
                </a>
              </li>
            </ul>
            <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
              <Megaphone className="mr-1 inline h-3.5 w-3.5" />
              Nothing's been published or sent yet. Review each artifact, then ship.
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
