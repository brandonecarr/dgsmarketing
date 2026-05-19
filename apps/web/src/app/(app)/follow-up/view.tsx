"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";

interface Step {
  delayHours: number;
  action: "send_sms" | "create_action";
  body: string;
  priority?: number;
}

interface CadenceRow {
  id: string;
  name: string;
  trigger: string;
  triggerStage: string | null;
  enabled: boolean;
  stopOnReply: boolean;
  stepCount: number;
  steps: Step[];
  stats: { total: number; active: number; completed: number };
  createdAt: string;
}

const STAGES = ["new", "engaged", "quoted", "qualified", "booked", "won", "lost"];

const TEMPLATES: Array<{ name: string; trigger: "lead_created" | "stage_change"; triggerStage?: string; steps: Step[] }> = [
  {
    name: "New lead — 3 touches",
    trigger: "lead_created",
    steps: [
      { delayHours: 0, action: "send_sms", body: "Hi {{firstName}}! Thanks for reaching out. Got a sec to share your zip and what you need help with?" },
      { delayHours: 4, action: "send_sms", body: "Hey {{firstName}}, just circling back — happy to send pricing once I know your zip + service." },
      { delayHours: 48, action: "create_action", body: "Manually follow up — lead {{firstName}} has gone cold after 2 nudges", priority: 4 },
    ],
  },
  {
    name: "Quoted — gentle nudge",
    trigger: "stage_change",
    triggerStage: "quoted",
    steps: [
      { delayHours: 24, action: "send_sms", body: "Hi {{firstName}}! Just making sure the quote made it through. Any questions before we book a slot?" },
      { delayHours: 72, action: "create_action", body: "Quoted lead {{firstName}} hasn't moved in 4 days — phone call?", priority: 3 },
    ],
  },
  {
    name: "Won — ask for review",
    trigger: "stage_change",
    triggerStage: "won",
    steps: [
      { delayHours: 24, action: "send_sms", body: "Thanks again {{firstName}}! If you have a sec, a Google review goes a long way: {{REVIEW_URL}}" },
    ],
  },
];

export function FollowUpView({ cadences: initial }: { cadences: CadenceRow[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<"lead_created" | "stage_change" | "manual">("lead_created");
  const [triggerStage, setTriggerStage] = useState("quoted");
  const [steps, setSteps] = useState<Step[]>([
    { delayHours: 0, action: "send_sms", body: "Hi {{firstName}}!" },
  ]);
  const [stopOnReply, setStopOnReply] = useState(true);
  const [saving, setSaving] = useState(false);

  function applyTemplate(t: (typeof TEMPLATES)[number]) {
    setName(t.name);
    setTrigger(t.trigger);
    if (t.triggerStage) setTriggerStage(t.triggerStage);
    setSteps(t.steps.map((s) => ({ ...s })));
  }

  async function save() {
    if (!name || steps.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/cadences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          trigger,
          triggerStage: trigger === "stage_change" ? triggerStage : undefined,
          steps,
          stopOnReply,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Save failed");
        return;
      }
      setShowAdd(false);
      setName("");
      setSteps([{ delayHours: 0, action: "send_sms", body: "Hi {{firstName}}!" }]);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(c: CadenceRow) {
    await fetch(`/api/cadences/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !c.enabled }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this cadence? Existing in-flight runs are not stopped.")) return;
    await fetch(`/api/cadences/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Lead Follow-Up</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Automated cadences. Triggered by a new lead or a stage change; stop if the lead
                replies (configurable). Steps either send an SMS or create an Action Plan item.
              </p>
            </div>
            <Button onClick={() => setShowAdd(true)} variant="outline">
              <Plus className="h-4 w-4" /> New cadence
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Cadences run on a 1-min cron. Add{" "}
            <code className="rounded bg-white/40 px-1">{`{ path: "/api/cadences/run", schedule: "* * * * *" }`}</code>{" "}
            to your vercel.json (auth: Bearer CRON_SECRET).
          </div>
        </CardBody>
      </Card>

      {showAdd ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">New cadence</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Pick a template or build your own.
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => applyTemplate(t)}
                  className="rounded-md border border-[hsl(var(--border))] p-3 text-left text-xs hover:bg-[hsl(var(--muted))]"
                >
                  <div className="font-semibold">{t.name}</div>
                  <div className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                    {t.steps.length} steps · {t.trigger}
                    {t.triggerStage ? ` → ${t.triggerStage}` : ""}
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Name" value={name} onChange={setName} placeholder="e.g. New lead — 3 touches" />
              <SelectField
                label="Trigger"
                value={trigger}
                onChange={(v) => setTrigger(v as typeof trigger)}
                options={[
                  { value: "lead_created", label: "New lead" },
                  { value: "stage_change", label: "Stage change" },
                  { value: "manual", label: "Manual" },
                ]}
              />
              {trigger === "stage_change" ? (
                <SelectField
                  label="When stage becomes"
                  value={triggerStage}
                  onChange={setTriggerStage}
                  options={STAGES.map((s) => ({ value: s, label: s }))}
                />
              ) : (
                <div />
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Steps
              </div>
              {steps.map((s, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 rounded-md border border-[hsl(var(--border))] p-2 md:grid-cols-[80px_120px_1fr_auto]"
                >
                  <NumberField
                    label="Wait (h)"
                    value={s.delayHours}
                    onChange={(v) =>
                      setSteps((p) =>
                        p.map((x, idx) => (idx === i ? { ...x, delayHours: v } : x)),
                      )
                    }
                  />
                  <SelectField
                    label="Action"
                    value={s.action}
                    onChange={(v) =>
                      setSteps((p) =>
                        p.map((x, idx) =>
                          idx === i ? { ...x, action: v as Step["action"] } : x,
                        ),
                      )
                    }
                    options={[
                      { value: "send_sms", label: "Send SMS" },
                      { value: "create_action", label: "Action item" },
                    ]}
                  />
                  <Field
                    label="Body"
                    value={s.body}
                    onChange={(v) =>
                      setSteps((p) => p.map((x, idx) => (idx === i ? { ...x, body: v } : x)))
                    }
                  />
                  <button
                    onClick={() => setSteps((p) => p.filter((_, idx) => idx !== i))}
                    className="self-end rounded-md border border-[hsl(var(--border))] p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    aria-label="Remove step"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSteps((p) => [
                    ...p,
                    { delayHours: 24, action: "send_sms", body: "Hi {{firstName}}!" },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add step
              </Button>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={stopOnReply}
                onChange={(e) => setStopOnReply(e.target.checked)}
              />
              Stop the cadence when the lead replies
            </label>

            <div className="flex gap-2">
              <Button onClick={save} disabled={saving || !name}>
                {saving ? "Saving…" : "Save cadence"}
              </Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {initial.length === 0 ? (
        <Card>
          <CardBody>
            <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              No cadences yet. Create one from a template above.
            </div>
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-2">
          {initial.map((c) => (
            <Card key={c.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggle(c)}
                        className={cn(
                          "inline-flex h-5 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          c.enabled
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
                            : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
                        )}
                      >
                        {c.enabled ? (
                          <ToggleRight className="h-3 w-3" />
                        ) : (
                          <ToggleLeft className="h-3 w-3" />
                        )}
                        {c.enabled ? "On" : "Off"}
                      </button>
                      <h3 className="font-semibold">{c.name}</h3>
                    </div>
                    <div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                      Trigger: <strong>{c.trigger}</strong>
                      {c.triggerStage ? ` → ${c.triggerStage}` : ""} · {c.stepCount} steps ·{" "}
                      {c.stats.active} active · {c.stats.completed} completed
                    </div>
                  </div>
                  <button
                    onClick={() => remove(c.id)}
                    className="rounded-md border border-[hsl(var(--border))] p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <ol className="mt-2 ml-4 list-decimal space-y-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                  {c.steps.map((s, i) => (
                    <li key={i}>
                      Wait <strong>{s.delayHours}h</strong> · {s.action === "send_sms" ? "SMS" : "Action"}:{" "}
                      <span className="font-mono">{s.body.slice(0, 80)}</span>
                      {s.body.length > 80 ? "…" : ""}
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          ))}
        </ul>
      )}
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
