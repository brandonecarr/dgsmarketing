"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Clock, CheckSquare, Square } from "lucide-react";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";

interface ActionRow {
  id: string;
  source: string;
  title: string;
  body: string | null;
  priority: number;
  metadata: Record<string, unknown> | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
}

const SOURCE_LABEL: Record<string, string> = {
  rule_review_after_won: "Coach · Review request",
  rule_followup_after_quoted: "Coach · Follow-up",
  rule_pause_zero_conv: "Coach · Pause ad",
  rule_gauge_slipping: "Coach · Gauge alert",
  rule_no_recent_post: "Coach · Posting cadence",
  rosie_suggestion: "Auto-Rosie",
  manual: "Manual",
};

const SOURCE_TONE: Record<string, string> = {
  rosie_suggestion:
    "bg-rosie-100 text-rosie-800 dark:bg-rosie-950 dark:text-rosie-100",
  rule_review_after_won:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  rule_followup_after_quoted:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  rule_pause_zero_conv: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
  rule_gauge_slipping: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
  rule_no_recent_post:
    "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
  manual: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export function ReviewView({ actions }: { actions: ActionRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const allChecked = selected.size > 0 && selected.size === actions.length;
  const noneChecked = selected.size === 0;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(actions.map((a) => a.id)));
  }

  async function bulk(status: "done" | "dismissed" | "snoozed", ids?: string[]) {
    const target = ids ?? Array.from(selected);
    if (target.length === 0) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { ids: target, status };
      if (status === "snoozed") {
        body.snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
      await fetch("/api/actions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSelected(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, ActionRow[]>();
    for (const a of actions) {
      const key = SOURCE_LABEL[a.source] ?? a.source;
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [actions]);

  if (actions.length === 0) {
    return (
      <Card>
        <CardBody className="px-5 py-10 text-center">
          <Check className="mx-auto h-6 w-6 text-emerald-600" />
          <p className="mt-2 text-sm font-semibold">Nothing to review.</p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Rosie hasn't flagged anything for you. New suggestions land here as the rules + agents
            fire throughout the week.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAll}
              className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs"
              aria-label={allChecked ? "Unselect all" : "Select all"}
            >
              {allChecked ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              {allChecked ? "Unselect all" : "Select all"}
            </button>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {selected.size > 0 ? `${selected.size} selected` : `${actions.length} open`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => bulk("done", actions.map((a) => a.id))}
              disabled={busy}
            >
              <Check className="h-3.5 w-3.5" /> Approve all ({actions.length})
            </Button>
            <Button
              variant="outline"
              onClick={() => bulk("done")}
              disabled={noneChecked || busy}
            >
              Approve selected
            </Button>
            <Button
              variant="outline"
              onClick={() => bulk("snoozed")}
              disabled={noneChecked || busy}
            >
              <Clock className="h-3.5 w-3.5" /> Snooze 24h
            </Button>
            <Button
              variant="outline"
              onClick={() => bulk("dismissed")}
              disabled={noneChecked || busy}
            >
              <X className="h-3.5 w-3.5" /> Dismiss
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {grouped.map(([groupName, items]) => (
          <div key={groupName}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              {groupName} · {items.length}
            </div>
            <ul className="divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))]">
              {items.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-3 py-2">
                  <button
                    onClick={() => toggleOne(a.id)}
                    aria-label={selected.has(a.id) ? "Unselect" : "Select"}
                    className="mt-0.5"
                  >
                    {selected.has(a.id) ? (
                      <CheckSquare className="h-4 w-4 text-rosie-700" />
                    ) : (
                      <Square className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                          SOURCE_TONE[a.source] ??
                            "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
                        )}
                      >
                        P{a.priority}
                      </span>
                      <span className="font-semibold text-sm">{a.title}</span>
                    </div>
                    {a.body ? (
                      <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))] line-clamp-3">
                        {a.body}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
