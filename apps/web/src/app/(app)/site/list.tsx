"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";

interface PageRow {
  id: string;
  slug: string;
  title: string;
  template: string;
  status: string;
  viewCount: number;
  conversionCount: number;
  publishedAt: string | null;
  createdAt: string;
}

const TEMPLATES = [
  { value: "service_hero", label: "Service hero", description: "Headline + bullets + 1–2 CTAs." },
  { value: "promo", label: "Promo", description: "Time-bound offer with a promo code." },
  { value: "review_request", label: "Review request", description: "Send Won customers here." },
  { value: "lead_form", label: "Lead form", description: "Embedded inline form posting to Rosie." },
];

const STATUS_PILL: Record<string, string> = {
  draft: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  published: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  archived: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
};

export function SiteList({ baseUrl, pages }: { baseUrl: string; pages: PageRow[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(pages.length === 0);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<string>("service_hero");
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!title) return;
    setCreating(true);
    try {
      const res = await fetch("/api/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, template }),
      });
      const j = (await res.json()) as { page?: { id: string }; error?: string };
      if (!res.ok || !j.page) {
        alert(j.error ?? "Create failed");
        return;
      }
      router.push(`/site/${j.page.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this landing page?")) return;
    await fetch(`/api/landing-pages/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Site Builder</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Templated landing pages that live at <code className="rounded bg-[hsl(var(--muted))] px-1">/{`p/`}your-slug</code>.
                First-party tracking + message-match from any campaign you link.
              </p>
            </div>
            <Button onClick={() => setShowAdd(true)} variant="outline">
              <Plus className="h-4 w-4" /> New page
            </Button>
          </div>
        </CardHeader>
      </Card>

      {showAdd ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Pick a template</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTemplate(t.value)}
                  className={cn(
                    "rounded-md border px-3 py-3 text-left transition",
                    template === t.value
                      ? "border-rosie-600 bg-rosie-50 dark:bg-rosie-950"
                      : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]",
                  )}
                >
                  <div className="text-sm font-semibold">{t.label}</div>
                  <div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                    {t.description}
                  </div>
                </button>
              ))}
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Page title
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekly Pet Waste Removal in Tucson"
                className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
              />
            </label>
            <div className="flex gap-2">
              <Button onClick={create} disabled={creating || !title}>
                {creating ? "Creating…" : "Create page"}
              </Button>
              {pages.length > 0 ? (
                <Button variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {pages.length > 0 ? (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-[hsl(var(--border))]">
              {pages.map((p) => (
                <li key={p.id} className="grid grid-cols-1 items-center gap-3 px-5 py-3 md:grid-cols-[1fr_auto_auto_auto]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/site/${p.id}`}
                        className="truncate text-sm font-semibold text-rosie-700 hover:underline"
                      >
                        {p.title}
                      </a>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          STATUS_PILL[p.status] ?? "",
                        )}
                      >
                        {p.status}
                      </span>
                    </div>
                    <div className="truncate text-[11px] font-mono text-[hsl(var(--muted-foreground))]">
                      {baseUrl}/p/{p.slug}
                    </div>
                  </div>
                  <Stat label="Views" value={p.viewCount} />
                  <Stat label="Conv." value={p.conversionCount} />
                  <div className="flex gap-1">
                    {p.status === "published" ? (
                      <a
                        href={`/p/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--muted))]"
                      >
                        <ExternalLink className="mr-0.5 inline h-3 w-3" /> Open
                      </a>
                    ) : null}
                    <a
                      href={`/site/${p.id}`}
                      className="rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--muted))]"
                    >
                      <Pencil className="mr-0.5 inline h-3 w-3" /> Edit
                    </a>
                    <button
                      onClick={() => remove(p.id)}
                      className="rounded-md border border-[hsl(var(--border))] p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
    </div>
  );
}
