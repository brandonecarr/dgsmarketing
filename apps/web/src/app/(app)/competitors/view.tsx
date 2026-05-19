"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Plus, RadioTower, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

interface CompetitorRow {
  id: string;
  name: string;
  domain: string | null;
  gbpUrl: string | null;
  metaPageId: string | null;
  notes: string | null;
  lastScanAt: string | null;
}

interface SignalRow {
  id: string;
  competitorId: string;
  kind: string;
  summary: string;
  observedAt: string;
}

const KIND_COLOR: Record<string, string> = {
  new_ad: "bg-rosie-100 text-rosie-700 dark:bg-rosie-900 dark:text-rosie-100",
  ad_paused: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  photo_added: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100",
  hours_changed: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  review_burst: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
  post_published: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100",
  domain_changed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  note: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
};

export function CompetitorsView({
  tenantId,
  competitors,
  signals,
  metaConfigured,
}: {
  tenantId: string;
  competitors: CompetitorRow[];
  signals: SignalRow[];
  metaConfigured: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(competitors.length === 0);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [gbpUrl, setGbpUrl] = useState("");
  const [metaPageId, setMetaPageId] = useState("");
  const [notes, setNotes] = useState("");
  const [scanning, setScanning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sb = getSupabaseBrowser();
    const ch = sb
      .channel(`competitors-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competitor_signals",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => startTransition(() => router.refresh()),
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [tenantId, router]);

  async function create() {
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          domain: domain || null,
          gbpUrl: gbpUrl || null,
          metaPageId: metaPageId || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Save failed");
        return;
      }
      setShowAdd(false);
      setName("");
      setDomain("");
      setGbpUrl("");
      setMetaPageId("");
      setNotes("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this competitor and its signals?")) return;
    await fetch(`/api/competitors/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function scan(id: string) {
    setScanning(id);
    try {
      const res = await fetch(`/api/competitors/${id}/scan`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Scan failed");
      }
      router.refresh();
    } finally {
      setScanning(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Competitor Intel</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Watch competitors' ads, GBP photos, hours, and reviews. Signals stream into the
                feed below.
              </p>
            </div>
            <Button onClick={() => setShowAdd(true)} variant="outline">
              <Plus className="h-4 w-4" /> Add competitor
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {!metaConfigured ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              Set <code className="rounded bg-white/40 px-1">META_AD_LIBRARY_TOKEN</code> to start
              pulling real ad-creative signals. Without it, scans only confirm the tracker is
              alive.
            </div>
          ) : (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              Meta Ad Library credentials detected. Scans pull live ad creative.
            </div>
          )}
        </CardBody>
      </Card>

      {showAdd ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">
              {competitors.length === 0 ? "Add your first competitor" : "Add competitor"}
            </h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Name" value={name} onChange={setName} placeholder="Acme Pet Care" />
              <Field
                label="Domain"
                value={domain}
                onChange={setDomain}
                placeholder="acmepetcare.com"
              />
              <Field
                label="Google Business URL"
                value={gbpUrl}
                onChange={setGbpUrl}
                placeholder="https://maps.app.goo.gl/…"
              />
              <Field
                label="Meta Page ID"
                value={metaPageId}
                onChange={setMetaPageId}
                placeholder="optional"
              />
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Notes
              </span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What makes this competitor relevant to watch?"
                className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
              />
            </label>
            <div className="flex gap-2">
              <Button onClick={create} disabled={saving || !name}>
                {saving ? "Saving…" : "Save competitor"}
              </Button>
              {competitors.length > 0 ? (
                <Button variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Watching ({competitors.length})</h3>
          </CardHeader>
          <CardBody className="p-0">
            {competitors.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
                No competitors added yet.
              </div>
            ) : (
              <ul className="divide-y divide-[hsl(var(--border))]">
                {competitors.map((c) => (
                  <li key={c.id} className="space-y-1 px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{c.name}</div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => scan(c.id)}
                          disabled={scanning === c.id}
                          className="rounded-md border border-[hsl(var(--border))] px-2 py-1 text-[10px] hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                        >
                          <RadioTower className="mr-0.5 inline h-3 w-3" />
                          {scanning === c.id ? "Scanning…" : "Run scan"}
                        </button>
                        <button
                          onClick={() => remove(c.id)}
                          className="rounded-md border border-[hsl(var(--border))] p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {c.domain ? (
                      <a
                        href={`https://${c.domain.replace(/^https?:\/\//, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-rosie-700 hover:underline"
                      >
                        <Globe className="h-3 w-3" />
                        {c.domain}
                      </a>
                    ) : null}
                    {c.notes ? (
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.notes}</p>
                    ) : null}
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {c.lastScanAt
                        ? `Last scan ${new Date(c.lastScanAt).toLocaleString()}`
                        : "Never scanned"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Signal feed</h3>
              <button
                onClick={() => router.refresh()}
                className="rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                aria-label="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {signals.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
                No signals yet. Hit “Run scan” on a competitor to seed the feed.
              </div>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-[hsl(var(--border))] overflow-y-auto">
                {signals.map((s) => {
                  const comp = competitors.find((c) => c.id === s.competitorId);
                  return (
                    <li key={s.id} className="px-5 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            KIND_COLOR[s.kind] ?? "bg-neutral-100 text-neutral-600",
                          )}
                        >
                          {s.kind.replace(/_/g, " ")}
                        </span>
                        <span className="font-semibold">{comp?.name ?? "Removed"}</span>
                        <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">
                          {new Date(s.observedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        {s.summary}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
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
