"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";

interface IntegrationRow {
  provider: "meta" | "google_ads" | "tiktok";
  connected: boolean;
  lastSyncAt: string | null;
}

const PLATFORMS: Array<{
  provider: "meta" | "google_ads" | "tiktok";
  title: string;
  subtitle: string;
  envNote: string;
}> = [
  {
    provider: "meta",
    title: "Meta Ads",
    subtitle: "Facebook + Instagram",
    envNote: "Set META_APP_ID + META_APP_SECRET in env.",
  },
  {
    provider: "google_ads",
    title: "Google Ads",
    subtitle: "Search, PMax, Display",
    envNote: "Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_ADS_DEVELOPER_TOKEN.",
  },
  {
    provider: "tiktok",
    title: "TikTok Ads",
    subtitle: "TikTok Marketing API",
    envNote: "Set TIKTOK_APP_ID + TIKTOK_APP_SECRET.",
  },
];

export function AdPlatformsCard({
  integrations,
  syncStatus,
}: {
  integrations: IntegrationRow[];
  syncStatus: string | null;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(syncStatus);

  async function sync(provider: string) {
    setSyncing(provider);
    setMsg(null);
    try {
      const res = await fetch(`/api/ads/${provider}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 30 }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(`${provider}: ${j.error ?? "sync failed"}`);
      } else {
        setMsg(
          `${provider}: ${j.accountsUpserted} account(s), ${j.campaignsUpserted} campaign(s), ${j.metricRows} metric rows`,
        );
        router.refresh();
      }
    } finally {
      setSyncing(null);
    }
  }

  return (
    <Card id="ads">
      <CardHeader>
        <h3 className="text-base font-semibold">Ad platforms</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Connect Meta / Google Ads / TikTok so Rosie can pace your Paid gauge, pause
          underperformers, and dedupe Pixel-fired conversions with the server-side Conversions API.
        </p>
      </CardHeader>
      <CardBody className="space-y-3">
        {msg ? (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            {msg}
          </div>
        ) : null}
        <ul className="space-y-2">
          {PLATFORMS.map((p) => {
            const row = integrations.find((i) => i.provider === p.provider);
            const connected = Boolean(row?.connected);
            return (
              <li
                key={p.provider}
                className="flex items-center justify-between gap-3 rounded-md border border-[hsl(var(--border))] p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{p.title}</div>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        connected
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
                          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
                      )}
                    >
                      {connected ? "Connected" : "Not connected"}
                    </span>
                  </div>
                  <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    {p.subtitle}
                    {row?.lastSyncAt
                      ? ` · last sync ${new Date(row.lastSyncAt).toLocaleString()}`
                      : ""}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]/80">
                    {p.envNote}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <a
                    href={`/api/ads/${p.provider}/start`}
                    className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs hover:bg-[hsl(var(--muted))]"
                  >
                    {connected ? "Reconnect" : "Connect"}
                  </a>
                  {connected ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sync(p.provider)}
                      disabled={syncing === p.provider}
                    >
                      {syncing === p.provider ? "Syncing…" : "Sync now"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
