"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Card, CardBody, CardHeader, Button } from "@rosie/ui";

const DEFAULT_INSTRUCTION =
  "A brand-new lead just came in. Read the lead's full thread + attribution, draft a warm, brief first reply that asks one specific qualifying question, and send it. If you don't have enough context, create an Action Plan item for the operator instead of sending. Do not advance the stage on this run.";

export function LeadAssistantToggle({
  enabled: initialEnabled,
  instruction: initialInstruction,
}: {
  enabled: boolean;
  instruction: string;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [instruction, setInstruction] = useState(initialInstruction);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch("/api/lead-assistant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, instruction: instruction || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Save failed");
        return;
      }
      setSaved(new Date().toLocaleTimeString());
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Lead Assistant</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            When ON, the Rosie agent fires automatically on every new lead. She reads the thread +
            attribution and either sends a warm first reply or creates an Action Plan item — whichever
            is right for the context.
          </p>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] p-3">
            <div>
              <div className="font-semibold">Auto-respond to new leads</div>
              <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Goes through the spend governor — won't fire if you're at your LLM cap.
              </div>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              {enabled ? "ON" : "OFF"}
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Instruction (optional)
            </span>
            <textarea
              rows={6}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={DEFAULT_INSTRUCTION}
              className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
            />
            <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
              Left blank uses Rosie's default first-touch playbook.
            </div>
          </label>

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
            </Button>
            {saved ? <span className="text-xs text-emerald-600">Saved at {saved}.</span> : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">How it works</h3>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
          <p>
            <strong>Triggered by:</strong> any new lead from the inbound SMS webhook OR a lead-intake
            webhook (Make.com, Facebook lead forms, public landing pages).
          </p>
          <p>
            <strong>What it can do:</strong> read the conversation, draft + send an SMS, create an
            Action Plan item, advance the stage. Each tool call is audited in /action-plan and
            individually undoable.
          </p>
          <p>
            <strong>Safety rails:</strong> stops at 5 steps, won't auto-send if budget is over the
            cap, and the agent's system prompt forbids stage moves on this specific run.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
