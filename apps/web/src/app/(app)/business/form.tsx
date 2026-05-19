"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save } from "lucide-react";
import { Card, CardBody, CardHeader, Button } from "@rosie/ui";

interface Character {
  name: string;
  role: string;
  description: string;
}

interface BrandVoice {
  storytellingStrategy?: string;
  contentPersonality?: string;
  sellingStyle?: string;
  postLength?: string;
  guardrails?: string;
  recurringCharacters?: Character[];
}

interface Props {
  tenantId: string;
  initial: {
    name: string;
    category: string;
    city: string;
    services: string[];
    brandVoice: BrandVoice;
  };
}

export function BusinessForm({ initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState(initial.category);
  const [city, setCity] = useState(initial.city);
  const [servicesText, setServicesText] = useState(initial.services.join(", "));
  const [voice, setVoice] = useState<BrandVoice>(initial.brandVoice);
  const [characters, setCharacters] = useState<Character[]>(
    initial.brandVoice.recurringCharacters ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch("/api/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          city,
          services: servicesText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          brandVoice: {
            ...voice,
            recurringCharacters: characters,
          },
        }),
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

  function updateCharacter(i: number, patch: Partial<Character>) {
    setCharacters((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">My Business</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            The brand voice and NAP that every Rosie drafting tool reads from.
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">Basics</h3>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Business name" value={name} onChange={setName} />
          <Field label="Category" value={category} onChange={setCategory} />
          <Field label="Primary city" value={city} onChange={setCity} />
          <Field
            label="Services (comma separated)"
            value={servicesText}
            onChange={setServicesText}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">Brand storytelling</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            The bigger arc Rosie tells in every post, ad, and reply.
          </p>
        </CardHeader>
        <CardBody className="space-y-3">
          <TextArea
            label="Storytelling strategy"
            placeholder="Use Facebook as a slow-burn documentary of a real local pooper-scooper business growing through consistency, systems, and care…"
            rows={5}
            value={voice.storytellingStrategy ?? ""}
            onChange={(v) => setVoice((p) => ({ ...p, storytellingStrategy: v }))}
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field
              label="Content personality"
              value={voice.contentPersonality ?? ""}
              onChange={(v) => setVoice((p) => ({ ...p, contentPersonality: v }))}
              placeholder="warm, lightly playful, never corny"
            />
            <Field
              label="Selling style"
              value={voice.sellingStyle ?? ""}
              onChange={(v) => setVoice((p) => ({ ...p, sellingStyle: v }))}
              placeholder="subtle, expert-led, never pushy"
            />
            <Field
              label="Post length"
              value={voice.postLength ?? ""}
              onChange={(v) => setVoice((p) => ({ ...p, postLength: v }))}
              placeholder="adaptive default"
            />
          </div>
          <TextArea
            label="Storytelling guardrails (what NOT to do)"
            placeholder="No corny inspiration. No fake banter. No corporate buzzwords. No exaggerated claims. No aggressive CTAs…"
            rows={5}
            value={voice.guardrails ?? ""}
            onChange={(v) => setVoice((p) => ({ ...p, guardrails: v }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Recurring characters</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                People, mascots, or personas Rosie references by name in drafts.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCharacters((p) => [...p, { name: "", role: "", description: "" }])
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add character
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          {characters.length === 0 ? (
            <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
              No recurring characters yet. Add a mascot, a key team member, or a brand persona.
            </div>
          ) : (
            characters.map((c, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-3 rounded-md border border-[hsl(var(--border))] p-3 md:grid-cols-[1fr_1fr_2fr_auto]"
              >
                <Field
                  label="Name"
                  value={c.name}
                  onChange={(v) => updateCharacter(i, { name: v })}
                />
                <Field
                  label="Role"
                  value={c.role}
                  onChange={(v) => updateCharacter(i, { role: v })}
                  placeholder="founder, mascot, driver…"
                />
                <Field
                  label="Description"
                  value={c.description}
                  onChange={(v) => updateCharacter(i, { description: v })}
                  placeholder="ten years in the field, dry humor, dog person"
                />
                <button
                  onClick={() => setCharacters((p) => p.filter((_, idx) => idx !== i))}
                  className="self-end rounded-md border border-[hsl(var(--border))] p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save brand profile"}
        </Button>
        {saved ? (
          <span className="text-xs text-emerald-600">Saved at {saved}.</span>
        ) : null}
      </div>
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

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
      />
    </label>
  );
}
