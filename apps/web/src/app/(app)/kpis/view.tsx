"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Target } from "lucide-react";
import { Card, CardBody, CardHeader, Button, GaugeRing } from "@rosie/ui";
import type { GaugeCluster } from "@/lib/gauges/types";

type KpiType =
  | "leads_per_month"
  | "revenue_per_month"
  | "cost_per_lead"
  | "close_rate"
  | "appointments_per_week"
  | "reviews_per_month"
  | "custom";

const TYPES: Array<{ value: KpiType; label: string; unit: string; direction: "higher_better" | "lower_better"; period: "weekly" | "monthly" | "quarterly" }> = [
  { value: "leads_per_month", label: "Leads per month", unit: "leads", direction: "higher_better", period: "monthly" },
  { value: "revenue_per_month", label: "Revenue per month", unit: "$", direction: "higher_better", period: "monthly" },
  { value: "cost_per_lead", label: "Cost per lead", unit: "$", direction: "lower_better", period: "monthly" },
  { value: "close_rate", label: "Close rate", unit: "%", direction: "higher_better", period: "monthly" },
  { value: "appointments_per_week", label: "Appointments per week", unit: "appts", direction: "higher_better", period: "weekly" },
  { value: "reviews_per_month", label: "Reviews per month", unit: "reviews", direction: "higher_better", period: "monthly" },
  { value: "custom", label: "Custom", unit: "", direction: "higher_better", period: "monthly" },
];

interface KpiRow {
  id: string;
  name: string;
  type: string;
  period: string;
  targetValue: number;
  direction: string;
  unit: string | null;
}

export function KpisView({ kpis, cluster }: { kpis: KpiRow[]; cluster: GaugeCluster }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(kpis.length === 0);
  const [type, setType] = useState<KpiType>("leads_per_month");
  const [name, setName] = useState("Leads per month");
  const [target, setTarget] = useState(30);
  const [saving, setSaving] = useState(false);

  function chooseType(t: KpiType) {
    setType(t);
    const def = TYPES.find((x) => x.value === t);
    if (def && t !== "custom") setName(def.label);
  }

  async function create() {
    const def = TYPES.find((x) => x.value === type);
    if (!def) return;
    setSaving(true);
    try {
      const res = await fetch("/api/kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          period: def.period,
          targetValue: target,
          direction: def.direction,
          unit: def.unit || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Save failed");
        return;
      }
      setShowAdd(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this KPI?")) return;
    await fetch(`/api/kpis/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">KPIs</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Set targets so Rosie can pace the month and grade the KPI gauge.
              </p>
            </div>
            <div className="text-right">
              <GaugeRing
                value={cluster.kpis.score ?? 0}
                status={cluster.kpis.status}
                label={cluster.grade ?? "—"}
              />
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {cluster.pacingHeadline ? (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              {cluster.pacingHeadline}
            </div>
          ) : (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {cluster.kpis.headline}
            </div>
          )}
        </CardBody>
      </Card>

      {kpis.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Active targets</h3>
              <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" /> Add KPI
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-[hsl(var(--border))]">
              {kpis.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-semibold">{k.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                      {k.type} · {k.period} · {k.direction.replace("_", " ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xl font-bold">
                        {k.targetValue}
                        {k.unit ? <span className="ml-1 text-xs font-normal text-[hsl(var(--muted-foreground))]">{k.unit}</span> : null}
                      </div>
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))]">target</div>
                    </div>
                    <button
                      onClick={() => remove(k.id)}
                      className="rounded-md border border-[hsl(var(--border))] p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {showAdd ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">
              {kpis.length === 0 ? "Set your first KPI" : "Add KPI"}
            </h3>
            {kpis.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Start with leads-per-month — it powers the KPI gauge and pacing.
              </p>
            ) : null}
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => chooseType(t.value)}
                  className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                    type === t.value
                      ? "border-rosie-600 bg-rosie-50 dark:bg-rosie-950"
                      : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Target className="h-3 w-3" /> {t.label}
                  </div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Name" value={name} onChange={setName} />
              <NumberField label="Target value" value={target} onChange={setTarget} />
            </div>
            <div className="flex gap-2">
              <Button onClick={create} disabled={saving}>
                {saving ? "Saving…" : "Save KPI"}
              </Button>
              {kpis.length > 0 ? (
                <Button variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
      />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
      />
    </label>
  );
}
