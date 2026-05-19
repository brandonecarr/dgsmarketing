"use client";

import { useEffect, useState } from "react";
import { Save, Shield } from "lucide-react";
import { Card, CardBody, CardHeader, Button } from "@rosie/ui";

interface BudgetState {
  budget: {
    llmUsdCap: string | null;
    smsCap: string | null;
    imageCap: string | null;
    voiceMinutesCap: string | null;
    hardBlock: string;
  } | null;
  spend: {
    llmUsd: number;
    smsSent: number;
    imagesGenerated: number;
    voiceMinutes: number;
    totalUsd: number;
  };
}

export function SpendCard({ tenantId: _tenantId }: { tenantId: string }) {
  const [state, setState] = useState<BudgetState | null>(null);
  const [llmCap, setLlmCap] = useState<string>("");
  const [smsCap, setSmsCap] = useState<string>("");
  const [imageCap, setImageCap] = useState<string>("");
  const [hardBlock, setHardBlock] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/spend-budgets");
    const j: BudgetState = await res.json();
    setState(j);
    setLlmCap(j.budget?.llmUsdCap ?? "");
    setSmsCap(j.budget?.smsCap ?? "");
    setImageCap(j.budget?.imageCap ?? "");
    setHardBlock((j.budget?.hardBlock ?? "true") === "true");
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch("/api/spend-budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llmUsdCap: llmCap === "" ? null : Number(llmCap),
          smsCap: smsCap === "" ? null : Number(smsCap),
          imageCap: imageCap === "" ? null : Number(imageCap),
          hardBlock,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Save failed");
        return;
      }
      setSaved(new Date().toLocaleTimeString());
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card id="spend">
      <CardHeader>
        <h3 className="text-base font-semibold">Spend governor</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Monthly caps. Leave blank for no cap. When "Hard block" is on, gated calls (AI, SMS, image gen) refuse once the cap is hit.
        </p>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Stat label="LLM ($ MTD)" value={state ? `$${state.spend.llmUsd.toFixed(2)}` : "—"} />
          <Stat label="SMS sent" value={state ? state.spend.smsSent : "—"} />
          <Stat label="Images" value={state ? state.spend.imagesGenerated : "—"} />
          <Stat label="Voice min" value={state ? state.spend.voiceMinutes : "—"} />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CapField label="LLM cap ($/mo)" value={llmCap} onChange={setLlmCap} placeholder="100" />
          <CapField label="SMS cap (per mo)" value={smsCap} onChange={setSmsCap} placeholder="500" />
          <CapField label="Image cap (per mo)" value={imageCap} onChange={setImageCap} placeholder="100" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hardBlock}
            onChange={(e) => setHardBlock(e.target.checked)}
          />
          <Shield className="h-3.5 w-3.5 text-amber-600" /> Hard block at cap (recommended)
        </label>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save caps"}
          </Button>
          {saved ? <span className="text-xs text-emerald-600">Saved at {saved}.</span> : null}
        </div>
      </CardBody>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
    </div>
  );
}

function CapField({
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
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
      />
    </label>
  );
}
