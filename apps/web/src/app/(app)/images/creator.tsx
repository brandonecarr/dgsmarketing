"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Image as ImageIcon } from "lucide-react";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";

type Format = "square" | "wide" | "story";

const FORMATS: Array<{ key: Format; label: string; size: string }> = [
  { key: "square", label: "Square", size: "1024×1024" },
  { key: "wide", label: "Wide", size: "1792×1024" },
  { key: "story", label: "Story", size: "1024×1792" },
];

interface RecentImage {
  id: string;
  name: string | null;
  url: string | null;
  format: string;
  createdAt: string;
}

export function ImageCreator({ recent }: { recent: RecentImage[] }) {
  const router = useRouter();
  const [visualDirection, setVisualDirection] = useState(
    "Ultra-realistic lifestyle photo, wide 16:9 composition. A clean, well-maintained residential backyard featuring a happy dog running across the lawn. Warm late-afternoon sunlight, real materials, photographic detail.",
  );
  const [style, setStyle] = useState("Realistic service ad");
  const [tone, setTone] = useState("Professional");
  const [imageType, setImageType] = useState("Full ad image");
  const [format, setFormat] = useState<Format>("wide");
  const [name, setName] = useState("");

  const [headline, setHeadline] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [ctaPrimary, setCtaPrimary] = useState("");
  const [ctaSecondary, setCtaSecondary] = useState("");
  const [finePrint, setFinePrint] = useState("");

  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<RecentImage | null>(recent[0] ?? null);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/creatives/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          visualDirection,
          style,
          tone,
          imageType,
          format,
          exactAdText: {
            headline: headline || undefined,
            body: bodyText || undefined,
            ctaPrimary: ctaPrimary || undefined,
            ctaSecondary: ctaSecondary || undefined,
            finePrint: finePrint || undefined,
          },
        }),
      });
      const json = (await res.json()) as { creative?: { id: string; url: string; format: string; name: string | null; createdAt: string }; error?: string };
      if (!res.ok || !json.creative) {
        alert(json.error ?? `Generate failed (${res.status})`);
        return;
      }
      setPreview({
        id: json.creative.id,
        name: json.creative.name,
        url: json.creative.url,
        format: json.creative.format,
        createdAt: json.creative.createdAt,
      });
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Create Image</h2>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            <Pill>OpenAI</Pill>
            <Pill>gpt-image-2</Pill>
            <Pill tone="ok">Ready</Pill>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label="Name (optional)" value={name} onChange={setName} placeholder="Backyard hero v1" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Image Type" value={imageType} onChange={setImageType} />
            <Field label="Tone" value={tone} onChange={setTone} />
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Visual Direction
            </span>
            <textarea
              rows={5}
              value={visualDirection}
              onChange={(e) => setVisualDirection(e.target.value)}
              className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
            />
          </label>

          <Field label="Style" value={style} onChange={setStyle} />

          <div className="rounded-md border border-[hsl(var(--border))] p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Exact Ad Text
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Field label="Headline" value={headline} onChange={setHeadline} placeholder="Stink FREE Weekends!" />
              <Field label="Body" value={bodyText} onChange={setBodyText} placeholder="Professional Pet Waste Removal Service" />
              <Field
                label="Primary CTA"
                value={ctaPrimary}
                onChange={setCtaPrimary}
                placeholder="Get Started Today!"
              />
              <Field
                label="Secondary CTA"
                value={ctaSecondary}
                onChange={setCtaSecondary}
                placeholder="Weekly service starting at $19/visit"
              />
              <div className="md:col-span-2">
                <Field label="Fine print" value={finePrint} onChange={setFinePrint} />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Format
            </div>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-center text-xs transition",
                    format === f.key
                      ? "border-rosie-600 bg-rosie-50 dark:bg-rosie-950 text-rosie-700 dark:text-rosie-200"
                      : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]",
                  )}
                >
                  <div className="font-semibold">{f.label}</div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{f.size}</div>
                </button>
              ))}
            </div>
          </div>

          <Button onClick={generate} disabled={generating} className="w-full">
            <Wand2 className="h-4 w-4" />
            {generating ? "Generating…" : "Generate Image"}
          </Button>
        </CardBody>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Preview</h3>
          </CardHeader>
          <CardBody>
            {preview?.url ? (
              <div className="space-y-3">
                <img
                  src={preview.url}
                  alt={preview.name ?? "Generated image"}
                  className="w-full rounded-md border border-[hsl(var(--border))]"
                />
                <div className="flex flex-wrap gap-2">
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-rosie-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Open full image
                  </a>
                  <button
                    onClick={() => navigator.clipboard?.writeText(preview.url!)}
                    className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs"
                  >
                    Copy URL
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))]">
                <ImageIcon className="mr-2 h-4 w-4" />
                Generate an image to preview it here.
              </div>
            )}
          </CardBody>
        </Card>

        {recent.length > 0 ? (
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold">Recent</h3>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                {recent.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setPreview(r)}
                    className="aspect-square overflow-hidden rounded-md border border-[hsl(var(--border))] hover:ring-2 hover:ring-rosie-500"
                    title={r.name ?? r.format}
                  >
                    {r.url ? (
                      <img src={r.url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>
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

function Pill({ children, tone }: { children: React.ReactNode; tone?: "ok" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 font-semibold",
        tone === "ok"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]",
      )}
    >
      {children}
    </span>
  );
}
