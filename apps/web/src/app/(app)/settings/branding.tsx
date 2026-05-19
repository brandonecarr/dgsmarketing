"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Upload } from "lucide-react";
import { Card, CardBody, CardHeader, Button } from "@rosie/ui";
import { SUPPORTED_LOCALES, localeDisplayName } from "@/lib/i18n";

interface BrandTheme {
  primaryColor?: string;
  accentColor?: string;
  sidebarColor?: string;
  backgroundColor?: string;
  logoUrl?: string;
  displayName?: string;
  assistantName?: string;
  hidePoweredBy?: boolean;
  smsNumber?: string;
  reviewUrl?: string;
}

export function BrandingCard({
  brandTheme,
  timezone: initialTz,
  locale: initialLocale,
}: {
  brandTheme: BrandTheme;
  timezone?: string;
  locale?: string;
}) {
  const router = useRouter();
  const [primary, setPrimary] = useState(brandTheme.primaryColor ?? "#5b21b6");
  const [accent, setAccent] = useState(brandTheme.accentColor ?? "#f59e0b");
  const [sidebarColor, setSidebarColor] = useState(brandTheme.sidebarColor ?? "");
  const [bg, setBg] = useState(brandTheme.backgroundColor ?? "");
  const [logoUrl, setLogoUrl] = useState(brandTheme.logoUrl ?? "");
  const [displayName, setDisplayName] = useState(brandTheme.displayName ?? "");
  const [assistantName, setAssistantName] = useState(brandTheme.assistantName ?? "");
  const [hidePoweredBy, setHidePoweredBy] = useState(brandTheme.hidePoweredBy ?? false);
  const [smsNumber, setSmsNumber] = useState(brandTheme.smsNumber ?? "");
  const [reviewUrl, setReviewUrl] = useState(brandTheme.reviewUrl ?? "");
  const [timezone, setTimezone] = useState(initialTz ?? "UTC");
  const [locale, setLocale] = useState(initialLocale ?? "en-US");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadLogo(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/branding/logo", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error ?? "Upload failed");
        return;
      }
      setLogoUrl(j.logoUrl);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch("/api/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryColor: primary,
          accentColor: accent,
          sidebarColor: sidebarColor || undefined,
          backgroundColor: bg || undefined,
          logoUrl: logoUrl || undefined,
          displayName: displayName || undefined,
          assistantName: assistantName || undefined,
          hidePoweredBy,
          smsNumber: smsNumber || undefined,
          reviewUrl: reviewUrl || undefined,
          timezone: timezone || undefined,
          locale: locale || undefined,
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

  return (
    <Card id="branding">
      <CardHeader>
        <h3 className="text-base font-semibold">Branding & white-label</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Colors, logo, and AI persona name. Public landing pages and the in-app shell pick this up automatically.
        </p>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextField label="Display name" value={displayName} onChange={setDisplayName} placeholder={brandTheme.displayName ?? "(falls back to business name)"} />
          <TextField label="Assistant name" value={assistantName} onChange={setAssistantName} placeholder="Rosie" />
          <div>
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Logo
            </span>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-10 w-10 rounded border border-[hsl(var(--border))] bg-white object-contain p-1"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-[hsl(var(--border))] text-[10px] text-[hsl(var(--muted-foreground))]">
                  —
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload"}
              </Button>
              {logoUrl ? (
                <button
                  type="button"
                  onClick={() => setLogoUrl("")}
                  className="text-[11px] text-[hsl(var(--muted-foreground))] underline hover:text-red-600"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="…or paste a URL"
              className="mt-2 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-rosie-500"
            />
          </div>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Timezone
            </span>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
            >
              {[
                "UTC",
                "America/New_York",
                "America/Chicago",
                "America/Denver",
                "America/Phoenix",
                "America/Los_Angeles",
                "America/Anchorage",
                "Pacific/Honolulu",
                "America/Toronto",
                "America/Vancouver",
                "Europe/London",
                "Europe/Berlin",
                "Australia/Sydney",
              ].map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Language &amp; region
            </span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
            >
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l} — {localeDisplayName(l)}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] text-[hsl(var(--muted-foreground))]">
              Drives date/number formatting in the dashboard and the default reply language.
            </span>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <ColorField label="Primary" value={primary} onChange={setPrimary} />
          <ColorField label="Accent" value={accent} onChange={setAccent} />
          <ColorField label="Sidebar" value={sidebarColor} onChange={setSidebarColor} optional />
          <ColorField label="Background" value={bg} onChange={setBg} optional />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextField
            label="SMS number (for click-to-text widget)"
            value={smsNumber}
            onChange={setSmsNumber}
            placeholder="+15555550100"
          />
          <TextField
            label="Google review URL"
            value={reviewUrl}
            onChange={setReviewUrl}
            placeholder="https://g.page/r/…/review"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hidePoweredBy}
            onChange={(e) => setHidePoweredBy(e.target.checked)}
          />
          Hide "Powered by Rosie" on public landing pages
        </label>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save branding"}
          </Button>
          {saved ? <span className="text-xs text-emerald-600">Saved at {saved}.</span> : null}
        </div>
      </CardBody>
    </Card>
  );
}

function TextField({
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

function ColorField({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
        {optional ? <span className="ml-1 text-[hsl(var(--muted-foreground))]/60">(optional)</span> : null}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded-md border border-[hsl(var(--border))] bg-transparent"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#hex"
          className="flex-1 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-rosie-500"
        />
      </div>
    </label>
  );
}
