import { Card, CardBody, CardHeader } from "@rosie/ui";
import { headers } from "next/headers";
import { loadActiveSession } from "@/lib/active-tenant";
import { BrandingCard } from "./branding";
import { SpendCard } from "./spend";
import { ApiKeysCard } from "./api-keys";
import { AdPlatformsCard } from "./ad-platforms";
import { PublishingCard } from "./publishing";
import { db, integrations, landingPages } from "@rosie/db";
import { and, eq, inArray } from "@rosie/db";
import { DomainCard } from "./domain";
import { RegionCard } from "./region";
import { VapiCard } from "./vapi";
import { EmbedCard } from "./embed";
import { WebhooksOutCard } from "./webhooks-out";

interface IntegrationDef {
  key: string;
  /** Slug into the public /integrations catalog for the "Setup guide" link. */
  catalogKey?: string;
  title: string;
  subtitle: string;
  status: "needs-setup" | "optional" | "connected";
  blurb: string;
  tags: string[];
  webhookHint?: (baseUrl: string, slug: string) => string;
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    key: "quo",
    catalogKey: "quo",
    title: "Quo",
    subtitle: "SMS / Voice",
    status: "needs-setup",
    blurb:
      "Primary messaging line. Inbound SMS flows into the Rosie inbox; outbound goes out from Quo numbers.",
    tags: ["sms", "inbox", "lead intake"],
    webhookHint: (base, slug) => `${base}/api/webhooks/messaging/quo/${slug}`,
  },
  {
    key: "openphone",
    catalogKey: "openphone",
    title: "OpenPhone",
    subtitle: "SMS / Voice (alt)",
    status: "optional",
    blurb:
      "Use this if you're migrating from a WARREN setup or already running OpenPhone. Same Rosie inbox.",
    tags: ["sms", "voice"],
    webhookHint: (base, slug) => `${base}/api/webhooks/messaging/openphone/${slug}`,
  },
  {
    key: "google",
    catalogKey: "google_business_profile",
    title: "Google",
    subtitle: "Ads + Business Profile + Calendar",
    status: "needs-setup",
    blurb:
      "Powers the Paid Ads gauge, Google Profile completeness, and appointment scheduling.",
    tags: ["ads", "gbp", "calendar"],
  },
  {
    key: "meta",
    catalogKey: "meta",
    title: "Meta",
    subtitle: "Ads + Lead Forms + CAPI",
    status: "needs-setup",
    blurb:
      "Reads ad performance, ingests lead-form submissions, and pushes server-side conversions back via CAPI.",
    tags: ["ads", "lead forms", "capi"],
    webhookHint: (base, slug) => `${base}/api/webhooks/leads/${slug}`,
  },
  {
    key: "make",
    catalogKey: "make",
    title: "Make.com",
    subtitle: "Automation bridge",
    status: "optional",
    blurb:
      "Use Make as an intake bridge into Rosie. POST any lead payload to the URL below; Rosie normalizes it into a lead in the New stage.",
    tags: ["webhooks", "custom"],
    webhookHint: (base, slug) => `${base}/api/webhooks/leads/${slug}`,
  },
  {
    key: "stripe",
    catalogKey: "stripe",
    title: "Stripe",
    subtitle: "Billing",
    status: "optional",
    blurb: "Track customer billing events. Phase 6.",
    tags: ["billing"],
  },
];

const STATUS_PILL: Record<IntegrationDef["status"], string> = {
  "needs-setup":
    "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-900",
  optional:
    "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700",
  connected:
    "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-900",
};

const STATUS_LABEL: Record<IntegrationDef["status"], string> = {
  "needs-setup": "Needs setup",
  optional: "Optional",
  connected: "Connected",
};

async function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ads_connected?: string; ads_error?: string }>;
}) {
  const session = await loadActiveSession();
  const baseUrl = await getBaseUrl();
  const sp = await searchParams;

  // Snapshot of which ad platforms are connected, for the AdPlatformsCard.
  const adRows = await db
    .select({
      provider: integrations.provider,
      status: integrations.status,
      updatedAt: integrations.updatedAt,
    })
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, session.tenant.id),
        inArray(integrations.provider, ["meta", "google_ads", "tiktok"]),
      ),
    );

  const tenantPages = await db
    .select({ slug: landingPages.slug, title: landingPages.title, status: landingPages.status })
    .from(landingPages)
    .where(eq(landingPages.tenantId, session.tenant.id));

  const adIntegrations = (["meta", "google_ads", "tiktok"] as const).map((p) => {
    const row = adRows.find((r) => r.provider === p);
    return {
      provider: p,
      connected: row?.status === "connected",
      lastSyncAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    };
  });

  const adsStatusMsg = sp.ads_connected
    ? `${sp.ads_connected} connected — hit "Sync now" to backfill 30 days of campaigns.`
    : sp.ads_error
      ? `Connection error: ${sp.ads_error}`
      : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Settings</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Connect the systems that feed Rosie. Each integration unlocks the corresponding
            gauge and tool surface.
          </p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <a
              href="#branding"
              className="rounded-md border border-[hsl(var(--border))] px-3 py-2 text-center text-xs hover:bg-[hsl(var(--muted))]"
            >
              Branding
            </a>
            <a
              href="/billing"
              className="rounded-md border border-[hsl(var(--border))] px-3 py-2 text-center text-xs hover:bg-[hsl(var(--muted))]"
            >
              Billing
            </a>
            <a
              href="#spend"
              className="rounded-md border border-[hsl(var(--border))] px-3 py-2 text-center text-xs hover:bg-[hsl(var(--muted))]"
            >
              Spend
            </a>
            <a
              href="#api-keys"
              className="rounded-md border border-[hsl(var(--border))] px-3 py-2 text-center text-xs hover:bg-[hsl(var(--muted))]"
            >
              API Keys
            </a>
          </div>
        </CardBody>
      </Card>

      <BrandingCard
        brandTheme={session.tenant.brandTheme ?? {}}
        timezone={session.tenant.timezone ?? "UTC"}
        locale={session.tenant.locale ?? "en-US"}
      />

      <DomainCard
        customDomain={session.tenant.customDomain ?? null}
        customDomainRootSlug={session.tenant.customDomainRootSlug ?? null}
        pages={tenantPages}
      />

      <RegionCard
        region={session.tenant.region ?? "us"}
        residencyOnly={Boolean(session.tenant.residencyOnly)}
      />

      <VapiCard />

      <EmbedCard
        tenantSlug={session.tenant.slug}
        baseUrl={baseUrl}
        smsNumber={
          (session.tenant.brandTheme as { smsNumber?: string } | null)?.smsNumber ?? null
        }
        reviewUrl={
          (session.tenant.brandTheme as { reviewUrl?: string } | null)?.reviewUrl ?? null
        }
      />

      <SpendCard tenantId={session.tenant.id} />

      <AdPlatformsCard integrations={adIntegrations} syncStatus={adsStatusMsg} />

      <PublishingCard
        metaConnected={adIntegrations.find((i) => i.provider === "meta")?.connected ?? false}
      />

      <ApiKeysCard />

      <WebhooksOutCard />


      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">Business</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            The brand voice and NAP that every drafting tool reads from.
          </p>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <Field label="Name" value={session.tenant.name} />
            <Field label="Slug" value={session.tenant.slug} mono />
            <Field label="Category" value={session.profile?.category ?? "—"} />
            <Field label="City" value={session.profile?.address?.city ?? "—"} />
            <Field label="Tenant ID" value={session.tenant.id} mono />
          </dl>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {INTEGRATIONS.map((i) => (
          <Card key={i.key}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{i.title}</h3>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{i.subtitle}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL[i.status]}`}
                >
                  {STATUS_LABEL[i.status]}
                </span>
              </div>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{i.blurb}</p>
              {i.webhookHint ? (
                <div className="mt-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Webhook URL
                  </div>
                  <code className="block break-all text-[11px] font-mono">
                    {i.webhookHint(baseUrl, session.tenant.slug)}
                  </code>
                </div>
              ) : null}
              {i.catalogKey ? (
                <a
                  href={`/integrations/${i.catalogKey}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-rosie-700 hover:underline dark:text-rosie-300"
                >
                  Setup guide ↗
                </a>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {i.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-[hsl(var(--border))] px-2 py-0.5 text-[10px]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </dt>
      <dd className={mono ? "font-mono text-xs" : ""}>{value}</dd>
    </div>
  );
}
