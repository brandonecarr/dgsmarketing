"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Card, CardBody, CardHeader, Button } from "@rosie/ui";

interface PageOption {
  slug: string;
  title: string;
  status: string;
}

export function DomainCard({
  customDomain,
  customDomainRootSlug,
  pages,
}: {
  customDomain: string | null;
  customDomainRootSlug: string | null;
  pages: PageOption[];
}) {
  const router = useRouter();
  const [domain, setDomain] = useState(customDomain ?? "");
  const [rootSlug, setRootSlug] = useState(customDomainRootSlug ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(null);
    setError(null);
    const cleaned = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    try {
      const res = await fetch("/api/tenant/domain", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDomain: cleaned ? cleaned : null,
          customDomainRootSlug: rootSlug ? rootSlug : null,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Save failed");
        return;
      }
      setSaved(new Date().toLocaleTimeString());
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card id="domain">
      <CardHeader>
        <h3 className="text-base font-semibold">Custom domain</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Serve your public landing pages from your own domain (e.g. <code>leads.acme.com</code>).
        </p>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Domain
            </span>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="leads.acme.com"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Root page (what visitors see at "/")
            </span>
            <select
              value={rootSlug}
              onChange={(e) => setRootSlug(e.target.value)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
            >
              <option value="">— Pick a published page —</option>
              {pages.map((p) => (
                <option key={p.slug} value={p.slug} disabled={p.status !== "published"}>
                  {p.title} ({p.slug}) {p.status !== "published" ? `· ${p.status}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-xs">
          <div className="font-semibold">DNS setup</div>
          <p className="mt-1 text-[hsl(var(--muted-foreground))]">
            Point your domain at this app: create a CNAME record from{" "}
            <code className="font-mono">{domain || "leads.acme.com"}</code> to{" "}
            <code className="font-mono">cname.vercel-dns.com</code>, then add the domain in your
            hosting provider so a cert is issued. Once DNS propagates, your root URL serves the
            page above; <code>/foo</code> serves <code>/p/foo</code>; everything else still works
            on the app domain.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
          </Button>
          {saved ? <span className="text-xs text-emerald-600">Saved at {saved}.</span> : null}
          {error ? <span className="text-xs text-red-600">{error}</span> : null}
        </div>
      </CardBody>
    </Card>
  );
}
