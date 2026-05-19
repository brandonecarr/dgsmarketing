"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Card, CardBody, CardHeader, Button } from "@rosie/ui";

interface Page {
  id: string;
  name: string | null;
  igUserId: string | null;
}

export function PublishingCard({ metaConnected }: { metaConnected: boolean }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [igUserId, setIgUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    if (!metaConnected) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/meta/pages");
      const j = await res.json();
      if (!res.ok) {
        setMsg(j.error ?? "Couldn't load Meta pages");
        return;
      }
      setPages(j.pages ?? []);
      setSelected(j.selected?.pageId ?? "");
      setIgUserId(j.selected?.igUserId ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaConnected]);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/meta/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: selected }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j.error ?? "Save failed");
        return;
      }
      setIgUserId(j.igUserId ?? null);
      setMsg(
        `Saved. Posts scheduled to Facebook will publish to this page${
          j.igUserId ? "; Instagram is linked too." : "."
        }`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card id="publishing">
      <CardHeader>
        <h3 className="text-base font-semibold">Publishing</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Which Facebook page (and linked Instagram account) your scheduled posts publish to.
          Cron <code className="rounded bg-[hsl(var(--muted))] px-1">/api/posts/publish-due</code>{" "}
          drains scheduled posts every minute.
        </p>
      </CardHeader>
      <CardBody className="space-y-3">
        {!metaConnected ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Connect Meta first (Ad platforms card above) to pick a posting page.
          </div>
        ) : loading ? (
          <div className="text-xs text-[hsl(var(--muted-foreground))]">Loading your pages…</div>
        ) : pages.length === 0 ? (
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            No pages on this Meta account.
          </div>
        ) : (
          <>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Posting page
              </span>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
              >
                <option value="">— pick one —</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name ?? p.id} {p.igUserId ? "· IG linked" : ""}
                  </option>
                ))}
              </select>
            </label>
            {igUserId ? (
              <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Instagram Business Account: <code className="font-mono">{igUserId}</code> — IG posts
                will go here.
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={saving || !selected}>
                <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save publishing target"}
              </Button>
              {msg ? <span className="text-xs text-[hsl(var(--muted-foreground))]">{msg}</span> : null}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
