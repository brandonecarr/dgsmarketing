"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Lock, Globe } from "lucide-react";
import { Card, CardBody, CardHeader, Button } from "@rosie/ui";

const REGION_LABEL: Record<string, string> = {
  us: "🇺🇸 United States · Virginia",
  eu: "🇪🇺 European Union · Frankfurt",
  au: "🇦🇺 Australia · Sydney",
};

export function RegionCard({
  region,
  residencyOnly,
}: {
  region: string;
  residencyOnly: boolean;
}) {
  const router = useRouter();
  const [strict, setStrict] = useState(residencyOnly);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch("/api/tenant/residency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residencyOnly: strict }),
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
    <Card id="region">
      <CardHeader>
        <h3 className="text-base font-semibold">Data residency</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Where this tenant&apos;s data physically lives. Region is set at sign-up and can&apos;t
          be changed without a migration ticket.
        </p>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-sm">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <span className="font-semibold">{REGION_LABEL[region] ?? region}</span>
          </div>
          <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
            All Postgres rows, Supabase Storage uploads, and Realtime events for this tenant
            stay inside this region.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-md border border-[hsl(var(--border))] p-3">
          <input
            type="checkbox"
            checked={strict}
            onChange={(e) => setStrict(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Lock className="h-3.5 w-3.5" /> Strict residency
            </div>
            <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
              When on, Rosie suppresses outbound API calls that would route through non-region
              services (Tinybird ingest from EU tenants, third-party AI providers without a
              regional endpoint, etc.). Pick this if you&apos;ve signed a DPA that requires it.
            </p>
          </div>
        </label>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving || strict === residencyOnly}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
          </Button>
          {saved ? <span className="text-xs text-emerald-600">Saved at {saved}.</span> : null}
        </div>
      </CardBody>
    </Card>
  );
}
