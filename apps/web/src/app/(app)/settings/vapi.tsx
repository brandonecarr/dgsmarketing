"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Card, CardBody, CardHeader, Button } from "@rosie/ui";

interface State {
  connected: boolean;
  hasApiKey: boolean;
  assistantId: string | null;
  phoneNumberId: string | null;
  firstMessage: string | null;
  systemPrompt: string | null;
  voiceId: string | null;
  modelId: string | null;
}

export function VapiCard() {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [modelId, setModelId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/integrations/vapi/config")
      .then((r) => r.json())
      .then((j: State) => {
        setState(j);
        setAssistantId(j.assistantId ?? "");
        setPhoneNumberId(j.phoneNumberId ?? "");
        setFirstMessage(j.firstMessage ?? "");
        setSystemPrompt(j.systemPrompt ?? "");
        setVoiceId(j.voiceId ?? "");
        setModelId(j.modelId ?? "");
      })
      .catch(() => setState({
        connected: false,
        hasApiKey: false,
        assistantId: null,
        phoneNumberId: null,
        firstMessage: null,
        systemPrompt: null,
        voiceId: null,
        modelId: null,
      }));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(null);
    try {
      const body: Record<string, string | undefined> = {
        assistantId: assistantId || undefined,
        phoneNumberId: phoneNumberId || undefined,
        firstMessage: firstMessage || undefined,
        systemPrompt: systemPrompt || undefined,
        voiceId: voiceId || undefined,
        modelId: modelId || undefined,
      };
      // Only send apiKey when the user typed a new one.
      if (apiKey.trim().length > 0) body.apiKey = apiKey.trim();

      const res = await fetch("/api/integrations/vapi/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error ?? "Save failed");
        return;
      }
      setSaved(new Date().toLocaleTimeString());
      setApiKey("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card id="vapi">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">Vapi voice assistant</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Configure the AI that answers your phone. The first message, system prompt, and
              voice are sent to Vapi as assistant overrides on every call.
            </p>
          </div>
          {state ? (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                state.connected
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-amber-300 bg-amber-50 text-amber-800"
              }`}
            >
              {state.connected ? "Connected" : "Not set up"}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field
            label={state?.hasApiKey ? "Vapi API key (leave blank to keep current)" : "Vapi API key"}
            value={apiKey}
            onChange={setApiKey}
            placeholder={state?.hasApiKey ? "•••••••• (current)" : "vapi_..."}
            type="password"
          />
          <Field
            label="Assistant ID"
            value={assistantId}
            onChange={setAssistantId}
            placeholder="asst_…"
          />
          <Field
            label="Phone number ID"
            value={phoneNumberId}
            onChange={setPhoneNumberId}
            placeholder="phn_…"
          />
          <Field
            label="Voice ID"
            value={voiceId}
            onChange={setVoiceId}
            placeholder="jennifer / burt / etc."
          />
          <Field
            label="Model"
            value={modelId}
            onChange={setModelId}
            placeholder="gpt-4o / claude-3-5-sonnet"
          />
        </div>
        <Field
          label="First message"
          value={firstMessage}
          onChange={setFirstMessage}
          placeholder="Hi, this is the front desk at …"
        />
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            System prompt
          </span>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            placeholder="You answer the phones for ACME Plumbing. Be warm, brief, and book the appointment."
            className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-rosie-500"
          />
        </label>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
          </Button>
          {saved ? <span className="text-xs text-emerald-600">Saved at {saved}.</span> : null}
        </div>
      </CardBody>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={type === "password" ? "new-password" : "off"}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
      />
    </label>
  );
}
