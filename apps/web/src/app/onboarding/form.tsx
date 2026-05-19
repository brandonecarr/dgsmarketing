"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@rosie/ui";
import { createTenant } from "./actions";

type TenantRegion = "us" | "eu" | "au";

const REGION_LABEL: Record<TenantRegion, string> = {
  us: "🇺🇸 United States",
  eu: "🇪🇺 European Union",
  au: "🇦🇺 Australia",
};

export function OnboardingForm({
  userId,
  email,
  regions = ["us"],
}: {
  userId: string;
  email: string;
  regions?: TenantRegion[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState<TenantRegion>(regions[0] ?? "us");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
      await createTenant({ userId, email, name, category, city, timezone: tz, region });
      router.replace("/overview");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Couldn't create the tenant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold">Tell Rosie about the business</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Three quick fields. You can change everything later.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Business name (e.g. Scoop Doggy Logs)"
          className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
        />
        <input
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (e.g. pet-waste removal)"
          className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
        />
        <input
          required
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Primary city (e.g. Tucson, AZ)"
          className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
        />
        {regions.length > 1 ? (
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Data residency
            </span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as TenantRegion)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
            >
              {regions.map((r) => (
                <option key={r} value={r}>
                  {REGION_LABEL[r]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] text-[hsl(var(--muted-foreground))]">
              Picks the data center where your tenant lives. Can&apos;t be changed later without
              a migration.
            </span>
          </label>
        ) : null}
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Setting up…" : "Continue"}
        </Button>
      </form>
    </div>
  );
}
