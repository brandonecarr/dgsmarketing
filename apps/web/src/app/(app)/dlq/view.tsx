"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw, X, ChevronDown } from "lucide-react";
import { cn } from "@rosie/ui";

interface Row {
  id: string;
  source: string;
  status: "pending" | "retrying" | "resolved" | "abandoned";
  summary: string | null;
  payload: Record<string, unknown>;
  lastError: string | null;
  attempts: number;
  replayCount: number;
  createdAt: string;
}

const STATUS_TONE: Record<Row["status"], string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  retrying: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
  resolved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  abandoned: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export function DlqView({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const sources = Array.from(new Set(rows.map((r) => r.source)));
  const visible = filter ? rows.filter((r) => r.source === filter) : rows;

  async function retry(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/dlq/${id}/retry`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) alert(`Retry failed: ${j.error ?? "unknown"}`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function abandon(id: string) {
    if (!confirm("Abandon this entry? It will not be retried again.")) return;
    setBusy(id);
    try {
      await fetch(`/api/dlq/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "abandoned" }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {sources.length > 1 ? (
        <div className="border-b border-[hsl(var(--border))] px-5 py-2">
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={filter === null} onClick={() => setFilter(null)}>
              All · {rows.length}
            </FilterChip>
            {sources.map((s) => (
              <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
                {s} · {rows.filter((r) => r.source === s).length}
              </FilterChip>
            ))}
          </div>
        </div>
      ) : null}

      <ul className="divide-y divide-[hsl(var(--border))]">
        {visible.map((r) => {
          const isOpen = expanded === r.id;
          return (
            <li key={r.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => setExpanded((p) => (p === r.id ? null : r.id))}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        STATUS_TONE[r.status],
                      )}
                    >
                      {r.status}
                    </span>
                    <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                      {r.source}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 text-[hsl(var(--muted-foreground))] transition",
                        isOpen ? "rotate-180" : "",
                      )}
                    />
                  </div>
                  <div className="mt-1 text-sm font-semibold">{r.summary ?? "—"}</div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {new Date(r.createdAt).toLocaleString()} · attempts {r.attempts} · replays{" "}
                    {r.replayCount}
                  </div>
                </button>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => retry(r.id)}
                    disabled={busy === r.id}
                    className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-[11px] font-semibold hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                    title="Retry this entry"
                  >
                    <RotateCw className={cn("h-3 w-3", busy === r.id && "animate-spin")} />
                    Retry
                  </button>
                  <button
                    onClick={() => abandon(r.id)}
                    disabled={busy === r.id}
                    className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300"
                    title="Mark this entry abandoned"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {isOpen ? (
                <div className="mt-2 space-y-2">
                  {r.lastError ? (
                    <pre className="overflow-x-auto rounded-md border border-red-200 bg-red-50 p-2 text-[10px] text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
                      {r.lastError}
                    </pre>
                  ) : null}
                  <pre className="overflow-x-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2 text-[10px]">
                    {JSON.stringify(r.payload, null, 2)}
                  </pre>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        active
          ? "border-rosie-600 bg-rosie-50 text-rosie-700 dark:bg-rosie-950 dark:text-rosie-200"
          : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
      )}
    >
      {children}
    </button>
  );
}
