"use client";

import { useState } from "react";
import { Check, ExternalLink, Globe, Phone, Star, X } from "lucide-react";
import { Card, CardBody, CardHeader, Button, GaugeRing, cn } from "@rosie/ui";

interface CompletenessField {
  key: string;
  label: string;
  ok: boolean;
}

interface Props {
  tenantName: string;
  connected: boolean;
  justConnected: boolean;
  googleConfigured: boolean;
  error: string | null;
  location: {
    name: string;
    title: string | null;
    address: string | null;
    phone: string | null;
    website: string | null;
    category: string | null;
    mapsUri: string | null;
    reviewUri: string | null;
  } | null;
  completeness: { pct: number; fields: CompletenessField[] };
  completenessSource: "google" | "local";
  reviews: Array<{
    id: string;
    reviewer: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    replied: boolean;
  }>;
  avgRating: number | null;
}

export function GbpView(props: Props) {
  const [postBody, setPostBody] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<string | null>(null);

  async function publish() {
    if (!postBody.trim() || !props.location) return;
    setPosting(true);
    setPostResult(null);
    try {
      const res = await fetch("/api/gbp/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationName: props.location.name,
          summary: postBody.trim(),
          actionUrl: ctaUrl || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPostResult(`Error: ${j.error ?? res.status}`);
      } else {
        setPostResult(`Posted to GBP ✓ (${j.name})`);
        setPostBody("");
        setCtaUrl("");
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Google Business Profile</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Connect your Google account so Rosie can read your reviews, complete the profile,
                and publish posts.
              </p>
            </div>
            <div>
              {!props.googleConfigured ? (
                <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
                  GOOGLE_CLIENT_ID not set
                </span>
              ) : props.connected ? (
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                  Connected
                </span>
              ) : (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  Needs setup
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          {props.error ? (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
              {props.error}
            </div>
          ) : null}
          {props.justConnected ? (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              Google connected. Reading profile…
            </div>
          ) : null}
          {!props.connected ? (
            <a
              href="/api/integrations/google/start"
              className="inline-flex items-center gap-2 rounded-md bg-rosie-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rosie-700"
            >
              Connect Google
            </a>
          ) : null}
        </CardBody>
      </Card>

      {props.location ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">{props.location.title ?? props.tenantName}</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{props.location.name}</p>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <ProfileField icon={Phone} label="Phone" value={props.location.phone} />
            <ProfileField icon={Globe} label="Website" value={props.location.website} link />
            <ProfileField label="Category" value={props.location.category} />
            <ProfileField label="Address" value={props.location.address} />
            <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
              {props.location.mapsUri ? (
                <a
                  href={props.location.mapsUri}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-2.5 py-1 text-xs hover:bg-[hsl(var(--muted))]"
                >
                  <ExternalLink className="h-3 w-3" /> View on Google Maps
                </a>
              ) : null}
              {props.location.reviewUri ? (
                <a
                  href={props.location.reviewUri}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-2.5 py-1 text-xs hover:bg-[hsl(var(--muted))]"
                >
                  <ExternalLink className="h-3 w-3" /> Review link
                </a>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Profile Completeness</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {props.completenessSource === "google"
                    ? "From your live Google Business Profile."
                    : "From the local profile you've filled in. Connect Google to grade the real GBP."}
                </p>
              </div>
              <GaugeRing
                value={props.completeness.pct}
                status={
                  props.completeness.pct >= 85
                    ? "healthy"
                    : props.completeness.pct >= 60
                      ? "watch"
                      : "critical"
                }
                label={`${props.completeness.pct}%`}
              />
            </div>
          </CardHeader>
          <CardBody>
            <ul className="space-y-1.5 text-sm">
              {props.completeness.fields.map((f) => (
                <li key={f.key} className="flex items-center gap-2">
                  {f.ok ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                  <span className={f.ok ? "" : "text-[hsl(var(--muted-foreground))]"}>{f.label}</span>
                </li>
              ))}
            </ul>
            {props.completeness.pct < 100 ? (
              <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                <strong>Tip:</strong> a complete profile ranks higher in local search and builds trust.
                Fill the missing fields {props.completenessSource === "google" ? "at business.google.com" : "on /business"}.
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Recent Reviews</h3>
                {props.avgRating !== null ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Avg {props.avgRating.toFixed(1)} ★ across the last {props.reviews.length} reviews
                  </p>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {props.reviews.length === 0 ? (
              <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                {props.connected ? "No reviews to show yet." : "Connect Google to pull reviews."}
              </div>
            ) : (
              <ul className="max-h-80 space-y-3 overflow-y-auto">
                {props.reviews.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-md border border-[hsl(var(--border))] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{r.reviewer}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="mt-0.5 flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn("h-3.5 w-3.5", i < r.rating ? "fill-current" : "opacity-25")}
                        />
                      ))}
                    </div>
                    {r.comment ? (
                      <p className="mt-1.5 text-xs text-[hsl(var(--foreground))]/90">{r.comment}</p>
                    ) : null}
                    {!r.replied ? (
                      <span className="mt-1 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        Needs reply
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {props.location ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Publish a Google Business post</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Goes live on your Google Business Profile under "Updates".
            </p>
          </CardHeader>
          <CardBody className="space-y-2">
            <textarea
              rows={4}
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              maxLength={1500}
              placeholder="Short update — what's new at the business this week?"
              className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
            />
            <input
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="Optional CTA link (e.g. your booking page)"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
            />
            <div className="flex items-center gap-3">
              <Button onClick={publish} disabled={!postBody.trim() || posting}>
                {posting ? "Publishing…" : "Publish to GBP"}
              </Button>
              {postResult ? (
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{postResult}</span>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function ProfileField({
  icon: Icon,
  label,
  value,
  link,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  link?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        {Icon ? <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" /> : null}
        {value ? (
          link ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-rosie-700 hover:underline"
            >
              {value}
            </a>
          ) : (
            <span>{value}</span>
          )
        ) : (
          <span className="text-[hsl(var(--muted-foreground))]">—</span>
        )}
      </div>
    </div>
  );
}
