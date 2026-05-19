"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { Card, CardBody, CardHeader, cn } from "@rosie/ui";
import type { ActivationStep } from "@/lib/activation";

export function ActivationChecklist({
  steps,
  done,
  total,
}: {
  steps: ActivationStep[];
  done: number;
  total: number;
}) {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  const pct = Math.round((done / total) * 100);

  // Empty state — no leads, no integrations — gets the loud "try sample data" CTA.
  const isEmpty = done === 0;

  async function seed() {
    if (!confirm("Drop in a few sample leads + messages to play with? You can clear them anytime.")) return;
    setSeeding(true);
    try {
      const res = await fetch("/api/onboarding/seed-sample", { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error ?? "Seeding failed");
        return;
      }
      router.refresh();
    } finally {
      setSeeding(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-rosie-700">
              Get started
            </div>
            <h2 className="mt-1 text-xl font-bold">
              {isEmpty
                ? "Welcome — let's get Rosie warmed up."
                : `${pct}% set up · ${done} of ${total} steps`}
            </h2>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Knock these out and Rosie can start pulling real data into your gauges.
            </p>
          </div>
          {isEmpty ? (
            <button
              onClick={seed}
              disabled={seeding}
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-rosie-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rosie-700 disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {seeding ? "Seeding…" : "Try with sample data"}
            </button>
          ) : null}
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-[hsl(var(--muted))]">
          <div
            className="h-full rounded-full bg-rosie-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>
      <CardBody className="p-0">
        <ul className="divide-y divide-[hsl(var(--border))]">
          {steps.map((s) => (
            <li key={s.id} className="px-5 py-3">
              <Link href={s.href} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                    s.done
                      ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
                      : "border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))]",
                  )}
                >
                  {s.done ? <Check className="h-3 w-3" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={cn("font-semibold", s.done && "text-[hsl(var(--muted-foreground))] line-through")}>
                    {s.title}
                  </div>
                  <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    {s.description}
                  </div>
                </div>
                {!s.done ? (
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-rosie-700" />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
