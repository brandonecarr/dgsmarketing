"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Megaphone } from "lucide-react";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";

interface MessageRow {
  id: string;
  name: string;
  body: string;
  status: string;
  recipientCount: number;
  createdAt: string;
  sentAt: string | null;
}

const STAGES = ["new", "engaged", "quoted", "qualified", "booked", "won", "lost"];

export function BulkView({ messages }: { messages: MessageRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [stages, setStages] = useState<string[]>(["engaged", "quoted"]);
  const [createdWithinDays, setCreatedWithinDays] = useState<number | "">("");
  const [noOutboundForDays, setNoOutboundForDays] = useState<number | "">("");
  const [commercial, setCommercial] = useState<"only" | "exclude" | "any">("any");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  function toggleStage(s: string) {
    setStages((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  }

  async function saveDraft({ sendNow }: { sendNow: boolean }) {
    if (!name || !body) return;
    setSaving(true);
    try {
      const filter = {
        stages,
        createdWithinDays: createdWithinDays === "" ? undefined : Number(createdWithinDays),
        noOutboundForDays: noOutboundForDays === "" ? undefined : Number(noOutboundForDays),
        commercial,
      };
      const res = await fetch("/api/bulk-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body, filter }),
      });
      const j = (await res.json()) as { bulkMessage?: { id: string }; previewCount?: number; error?: string };
      if (!res.ok || !j.bulkMessage) {
        alert(j.error ?? "Save failed");
        return;
      }
      if (sendNow) {
        await send(j.bulkMessage.id);
      } else {
        router.refresh();
        setLastResult(`Draft saved. ${j.previewCount ?? 0} recipients match.`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function send(id: string) {
    setSending(id);
    try {
      const res = await fetch(`/api/bulk-messages/${id}/send`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error ?? "Send failed");
        return;
      }
      setLastResult(`Sent ${j.sent} · failed ${j.failed} · skipped ${j.skipped} of ${j.recipients}.`);
      router.refresh();
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Bulk Messages</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Send the same SMS to a filtered cohort of leads. Goes through the spend governor —
            blows up safely if you're over your SMS cap.
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">Compose</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Name (internal)" value={name} onChange={setName} placeholder="Spring promo blast" />
            <SelectField
              label="Commercial leads"
              value={commercial}
              onChange={(v) => setCommercial(v as typeof commercial)}
              options={[
                { value: "any", label: "Any" },
                { value: "only", label: "Commercial only" },
                { value: "exclude", label: "Residential only" },
              ]}
            />
          </div>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Message body
            </span>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi! Quick heads up about our spring promo…"
              className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
            />
            <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{body.length} chars</div>
          </label>

          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Stages
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleStage(s)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition",
                    stages.includes(s)
                      ? "border-rosie-600 bg-rosie-50 text-rosie-700 dark:bg-rosie-950 dark:text-rosie-200"
                      : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <NumberField
              label="Created within (days)"
              value={createdWithinDays === "" ? 0 : createdWithinDays}
              onChange={(v) => setCreatedWithinDays(v || "")}
            />
            <NumberField
              label="No outbound for (days)"
              value={noOutboundForDays === "" ? 0 : noOutboundForDays}
              onChange={(v) => setNoOutboundForDays(v || "")}
            />
          </div>

          {lastResult ? (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              {lastResult}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => saveDraft({ sendNow: false })} disabled={saving || !name || !body}>
              Save draft
            </Button>
            <Button onClick={() => saveDraft({ sendNow: true })} disabled={saving || !name || !body}>
              <Send className="h-4 w-4" />
              {saving ? "Sending…" : "Save & send now"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">History</h3>
        </CardHeader>
        <CardBody>
          {messages.length === 0 ? (
            <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
              <Megaphone className="mx-auto mb-2 h-5 w-5" />
              No bulk messages yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {messages.map((m) => (
                <li key={m.id} className="rounded-md border border-[hsl(var(--border))] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                        {m.status} · {m.recipientCount} recipients ·{" "}
                        {m.sentAt
                          ? `sent ${new Date(m.sentAt).toLocaleString()}`
                          : `created ${new Date(m.createdAt).toLocaleString()}`}
                      </div>
                    </div>
                    {m.status === "draft" || m.status === "scheduled" ? (
                      <Button size="sm" onClick={() => send(m.id)} disabled={sending === m.id}>
                        <Send className="h-3.5 w-3.5" />
                        {sending === m.id ? "Sending…" : "Send now"}
                      </Button>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs">{m.body}</p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
