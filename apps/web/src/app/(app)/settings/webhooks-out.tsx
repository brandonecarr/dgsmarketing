"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Copy, Check } from "lucide-react";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";

const ALL_EVENTS = [
  "lead.created",
  "lead.stage_changed",
  "lead.won",
  "conversation.message_received",
  "conversation.message_sent",
  "call.completed",
  "review.received",
] as const;

type EventName = (typeof ALL_EVENTS)[number];

interface Sub {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
}

export function WebhooksOutCard() {
  const router = useRouter();
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string } | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/webhook-subscriptions");
    if (!res.ok) return;
    const j = await res.json();
    setSubs(j.data ?? []);
  }

  async function remove(id: string) {
    if (!confirm("Delete this subscription? Future events will not be delivered.")) return;
    await fetch(`/api/webhook-subscriptions/${id}`, { method: "DELETE" });
    load();
    router.refresh();
  }

  async function toggleEnabled(s: Sub) {
    await fetch(`/api/webhook-subscriptions/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !s.enabled }),
    });
    load();
  }

  return (
    <Card id="webhooks-out">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Outbound webhooks</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Subscribe an external URL to events Rosie emits — new leads, inbound replies, won
              deals, finished calls. Every delivery is HMAC-SHA256 signed; see{" "}
              <a href="/docs/api" className="text-rosie-700 underline">
                the API docs
              </a>{" "}
              for verification snippets.
            </p>
          </div>
          <Button onClick={() => setCreating(true)} variant="outline">
            <Plus className="h-3.5 w-3.5" /> Add subscription
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {creating ? (
          <CreateForm
            onCancel={() => setCreating(false)}
            onCreated={(secret, id) => {
              setCreating(false);
              setRevealedSecret({ id, secret });
              load();
            }}
          />
        ) : null}

        {revealedSecret ? (
          <RevealedSecret
            secret={revealedSecret.secret}
            onClose={() => setRevealedSecret(null)}
          />
        ) : null}

        {subs === null ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading…</p>
        ) : subs.length === 0 ? (
          <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-center text-xs text-[hsl(var(--muted-foreground))]">
            No subscriptions yet. Add one to start receiving Rosie events.
          </p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))]">
            {subs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{s.name}</span>
                    {s.suspendedAt ? (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-800 dark:bg-red-950 dark:text-red-100">
                        Suspended
                      </span>
                    ) : !s.enabled ? (
                      <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                        Disabled
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="break-all font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                    {s.url}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(s.events.length === 0 ? ["*"] : s.events).map((e) => (
                      <span
                        key={e}
                        className="rounded-full border border-[hsl(var(--border))] px-1.5 py-0.5 text-[9px] font-mono"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleEnabled(s)}
                    className="rounded-md border border-[hsl(var(--border))] px-2 py-1 text-[11px] hover:bg-[hsl(var(--muted))]"
                  >
                    {s.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    className="rounded-md border border-[hsl(var(--border))] p-1.5 text-red-700 hover:bg-red-50 dark:text-red-300"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function CreateForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (secret: string, id: string) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<EventName[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleEvent(e: EventName) {
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  async function submit() {
    if (!name || !url) return;
    setSaving(true);
    try {
      const res = await fetch("/api/webhook-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, events }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error ?? "Create failed");
        return;
      }
      onCreated(j.secret, j.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 space-y-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Zapier — Lead intake"
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            URL
          </span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.example.com/rosie"
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <div>
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          Events ({events.length === 0 ? "all" : events.length})
        </span>
        <div className="mt-1 flex flex-wrap gap-1">
          {ALL_EVENTS.map((e) => (
            <button
              key={e}
              onClick={() => toggleEvent(e)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-mono",
                events.includes(e)
                  ? "border-rosie-600 bg-rosie-50 text-rosie-700 dark:bg-rosie-950 dark:text-rosie-200"
                  : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]",
              )}
            >
              {e}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
          Leave empty to receive every event type.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={saving || !name || !url}>
          {saving ? "Creating…" : "Create"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function RevealedSecret({ secret, onClose }: { secret: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950">
      <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
        Save this signing secret now
      </div>
      <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
        You won't be able to see it again. Use it to verify the HMAC signature on every
        incoming Rosie webhook.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 break-all rounded-md border border-amber-300 bg-amber-100 px-2 py-1.5 font-mono text-[11px] text-amber-900 dark:bg-amber-900 dark:text-amber-100">
          {secret}
        </code>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(secret).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-amber-300 px-2 py-1 text-[10px] font-semibold"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={onClose}
          className="rounded-md border border-amber-300 px-2 py-1 text-[10px]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
