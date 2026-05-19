"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Check,
  Clock,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

interface ActionRow {
  id: string;
  title: string;
  body: string | null;
  status: string;
  source: string;
  priority: number;
  metadata: Record<string, unknown> | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
  completedAt: string | null;
}
interface RunRow {
  id: string;
  ruleName: string;
  status: string;
  durationMs: number | null;
  createdAt: string;
  undoToken: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  rule_review_after_won: "Review request",
  rule_followup_after_quoted: "Follow-up",
  rule_pause_zero_conv: "Funnel check",
  rule_gauge_slipping: "Gauge slipping",
  rule_no_recent_post: "Organic cadence",
  rosie_suggestion: "Rosie",
  manual: "Manual",
};

export function ActionPlanView({
  tenantId,
  actions,
  runs,
}: {
  tenantId: string;
  actions: ActionRow[];
  runs: RunRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [runningAgent, setRunningAgent] = useState(false);
  const [filter, setFilter] = useState<"open" | "all">("open");

  useEffect(() => {
    const sb = getSupabaseBrowser();
    const channel = sb
      .channel(`actions-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "actions", filter: `tenant_id=eq.${tenantId}` },
        () => startTransition(() => router.refresh()),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auto_rosie_runs", filter: `tenant_id=eq.${tenantId}` },
        () => startTransition(() => router.refresh()),
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [tenantId, router]);

  async function runRosie() {
    setRunning(true);
    try {
      const res = await fetch("/api/auto-rosie/run", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Run failed");
        return;
      }
      router.refresh();
    } finally {
      setRunning(false);
    }
  }

  async function runAgent() {
    setRunningAgent(true);
    try {
      const res = await fetch("/api/auto-rosie/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Agent failed");
        return;
      }
      router.refresh();
    } finally {
      setRunningAgent(false);
    }
  }

  async function undo(token: string) {
    if (!confirm("Undo this Rosie action?")) return;
    const res = await fetch(`/api/auto-rosie/undo/${token}`, { method: "POST" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Undo failed");
      return;
    }
    router.refresh();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    router.refresh();
  }

  const visible = actions.filter((a) => (filter === "open" ? a.status !== "done" && a.status !== "dismissed" : true));
  const openCount = actions.filter((a) => a.status === "open").length;
  const inProgressCount = actions.filter((a) => a.status === "in_progress").length;
  const doneToday = actions.filter(
    (a) => a.status === "done" && a.completedAt && new Date(a.completedAt).toDateString() === new Date().toDateString(),
  ).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Action Plan</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                The next moves Rosie recommends for {actions.length === 0 ? "your business" : "today"},
                ranked by leverage.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={runRosie} disabled={running} variant="outline">
                <Bot className="h-4 w-4" />
                {running ? "Running…" : "Run rules"}
              </Button>
              <Button onClick={runAgent} disabled={runningAgent}>
                <Wand2 className="h-4 w-4" />
                {runningAgent ? "Thinking…" : "Run Rosie (agent)"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Stat label="Open" value={openCount} tone="default" />
            <Stat label="In progress" value={inProgressCount} tone="warn" />
            <Stat label="Done today" value={doneToday} tone="ok" />
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center gap-2">
        <FilterBtn active={filter === "open"} onClick={() => setFilter("open")}>
          Active
        </FilterBtn>
        <FilterBtn active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterBtn>
        <button
          onClick={() => router.refresh()}
          className="ml-auto rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
          aria-label="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardBody>
            <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              <Sparkles className="mx-auto mb-2 h-5 w-5" />
              No active actions. Hit <strong>Run Auto-Rosie now</strong> to scan the funnel for next moves.
            </div>
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-2">
          {visible.map((a) => (
            <Card key={a.id} className={a.status === "in_progress" ? "border-rosie-500" : undefined}>
              <CardBody>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <PriorityChip priority={a.priority} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[hsl(var(--border))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                        {SOURCE_LABEL[a.source] ?? a.source}
                      </span>
                      <StatusPill status={a.status} />
                    </div>
                    <div className="mt-1 text-base font-semibold">{a.title}</div>
                    {a.body ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[hsl(var(--foreground))]/90">
                        {a.body}
                      </p>
                    ) : null}
                    {a.metadata && typeof a.metadata === "object" && "draftMessage" in a.metadata ? (
                      <div className="mt-2 rounded-md border border-rosie-200 bg-rosie-50 p-2 text-xs dark:border-rosie-900 dark:bg-rosie-950">
                        <div className="mb-1 font-semibold text-rosie-700 dark:text-rosie-200">
                          Drafted message
                        </div>
                        <div className="font-mono text-[11px] whitespace-pre-wrap">
                          {String((a.metadata as { draftMessage?: string }).draftMessage)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {a.status === "open" ? (
                      <Button size="sm" variant="outline" onClick={() => patch(a.id, { status: "in_progress" })}>
                        <Play className="h-3.5 w-3.5" /> Start
                      </Button>
                    ) : null}
                    {a.status !== "done" ? (
                      <Button size="sm" onClick={() => patch(a.id, { status: "done" })}>
                        <Check className="h-3.5 w-3.5" /> Done
                      </Button>
                    ) : null}
                    {a.status !== "snoozed" && a.status !== "done" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          patch(a.id, { status: "snoozed", snoozedUntil: tomorrow.toISOString() });
                        }}
                      >
                        <Clock className="h-3.5 w-3.5" /> Snooze
                      </Button>
                    ) : null}
                    {a.status !== "dismissed" && a.status !== "done" ? (
                      <Button size="sm" variant="ghost" onClick={() => patch(a.id, { status: "dismissed" })}>
                        <X className="h-3.5 w-3.5" /> Dismiss
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">Recent Auto-Rosie activity</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Every rule invocation is logged. Phase 5 wires up one-click undo.
          </p>
        </CardHeader>
        <CardBody>
          {runs.length === 0 ? (
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              No runs yet. Hit “Run Auto-Rosie now” to kick the rule engine.
            </div>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {runs.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-1.5 w-1.5 rounded-full",
                        r.status === "success"
                          ? "bg-emerald-500"
                          : r.status === "skipped"
                            ? "bg-neutral-400"
                            : "bg-red-500",
                      )}
                    />
                    <span className="font-mono">{r.ruleName}</span>
                    <span className="text-[hsl(var(--muted-foreground))]">{r.status}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                    <span>
                      {r.durationMs ? `${r.durationMs}ms · ` : ""}
                      {new Date(r.createdAt).toLocaleTimeString()}
                    </span>
                    {r.undoToken ? (
                      <button
                        onClick={() => undo(r.undoToken!)}
                        className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] px-1.5 py-0.5 text-[10px] hover:bg-[hsl(var(--muted))]"
                        title="Reverse this action"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Undo
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "default" | "ok" | "warn" }) {
  return (
    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-center">
      <div
        className={cn(
          "text-2xl font-bold",
          tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "",
        )}
      >
        {value}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
    </div>
  );
}

function PriorityChip({ priority }: { priority: number }) {
  const tone =
    priority <= 2
      ? "bg-red-500 text-white"
      : priority <= 4
        ? "bg-amber-500 text-amber-950"
        : "bg-rosie-100 text-rosie-700 dark:bg-rosie-900 dark:text-rosie-100";
  return (
    <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", tone)}>
      {priority}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "in_progress"
      ? "bg-rosie-100 text-rosie-700 dark:bg-rosie-900 dark:text-rosie-100"
      : status === "done"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-100"
        : status === "snoozed"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-100"
          : status === "dismissed"
            ? "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", tone)}>
      {status.replace("_", " ")}
    </span>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1 text-xs font-semibold transition",
        active
          ? "border-rosie-600 bg-rosie-50 text-rosie-700 dark:bg-rosie-950 dark:text-rosie-200"
          : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
      )}
    >
      {children}
    </button>
  );
}
