/**
 * Source of truth for the "Works with Rosie" marketplace.
 *
 * Everything that touches integrations — the settings cards, the public
 * /integrations page, the per-provider detail pages, the OAuth start
 * scaffolding — reads from this catalog. Add a row here when you ship a new
 * provider; don't duplicate metadata in component files.
 */

export type IntegrationStatus = "stable" | "beta" | "alpha" | "planned";
export type IntegrationCategory =
  | "messaging"
  | "voice"
  | "ads"
  | "crm"
  | "automation"
  | "search"
  | "billing"
  | "ai"
  | "analytics";

export interface IntegrationDef {
  key: string;
  name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  /** One-liner used on the catalog card. */
  tagline: string;
  /** Long description used on the detail page. */
  description: string;
  /** What it unlocks in the Rosie product. */
  unlocks: string[];
  /** Bullet-point setup steps. */
  setup: string[];
  /** When the connect button is wired up: an in-app path. Otherwise undefined. */
  connectPath?: string;
  /** External docs the operator should read alongside the setup. */
  docsUrl?: string;
  /** Marketing tags. */
  tags: string[];
}

export const INTEGRATIONS: IntegrationDef[] = [
  {
    key: "quo",
    name: "Quo",
    category: "messaging",
    status: "stable",
    tagline: "Primary SMS + voice line for the Rosie inbox.",
    description:
      "Quo is the recommended SMS provider for tenants on Rosie. Inbound texts land in the Rosie inbox in real time; outbound sends route through your Quo number with attribution + delivery tracking.",
    unlocks: [
      "Two-way SMS conversations in the inbox",
      "Outbound cadences + bulk campaigns",
      "Auto-reply to STOP/HELP/START keywords (TCPA-compliant)",
      "Predictive lead scoring on inbound text",
    ],
    setup: [
      "Create a Quo account and provision a number.",
      "In Quo settings, set the inbound webhook to /api/webhooks/messaging/quo/<your-slug>.",
      "Paste your Quo API key into Settings → Vapi / messaging.",
      "Send yourself a test text — it should appear in the inbox within seconds.",
    ],
    docsUrl: "https://quo.io/docs",
    tags: ["sms", "voice", "inbox", "tcpa"],
  },
  {
    key: "openphone",
    name: "OpenPhone",
    category: "messaging",
    status: "stable",
    tagline: "Alternate SMS provider, same Rosie inbox.",
    description:
      "Use OpenPhone if you're migrating from a legacy stack or already running it. Inbound messages flow into the same Rosie inbox as Quo; cadences and bulk sends work identically.",
    unlocks: [
      "Two-way SMS conversations in the inbox",
      "Same cadence + bulk engine as Quo",
      "Per-tenant HMAC-verified webhook ingest",
    ],
    setup: [
      "In OpenPhone → Workspace settings → Webhooks, point at /api/webhooks/messaging/openphone/<your-slug>.",
      "Copy the HMAC signing secret into Rosie's integration settings.",
      "Test by texting the OpenPhone number.",
    ],
    docsUrl: "https://www.openphone.com/api",
    tags: ["sms", "voice", "inbox"],
  },
  {
    key: "vapi",
    name: "Vapi",
    category: "voice",
    status: "stable",
    tagline: "AI voice agent that answers your phone.",
    description:
      "Vapi powers the AI receptionist. Configure assistant ID, phone number, voice, model, first message, and system prompt directly in Rosie — the integration UI never exposes the API key after first save.",
    unlocks: [
      "AI receptionist for inbound calls",
      "Outbound AI calls (`/api/calls/outbound`)",
      "Transcripts + summaries in the inbox",
      "Call recordings rendered inline with `<audio>` playback",
    ],
    setup: [
      "Create an assistant in Vapi dashboard.",
      "Buy a phone number in Vapi and link it to the assistant.",
      "Configure inbound webhook to /api/integrations/vapi/inbound/<your-slug>.",
      "In Rosie: Settings → Vapi → paste API key, assistant ID, phone-number ID.",
    ],
    connectPath: "/settings#vapi",
    docsUrl: "https://docs.vapi.ai",
    tags: ["voice", "ai", "phone"],
  },
  {
    key: "meta",
    name: "Meta (Facebook + Instagram)",
    category: "ads",
    status: "stable",
    tagline: "Ads performance + Lead Forms + CAPI conversions.",
    description:
      "Connects to Meta Marketing API for ad performance metrics, Lead Ads form ingestion, and server-side Conversions API (CAPI) for ad-account-quality conversion signals.",
    unlocks: [
      "Paid Ads gauge powered by real spend/ROAS data",
      "Lead Forms ingested directly into the inbox",
      "Server-side CAPI conversions on every won lead",
      "Per-page selection for IG DM ingestion",
    ],
    setup: [
      "Settings → Ad platforms → Connect Meta.",
      "Grant ads_management, leads_retrieval, and pages_show_list scopes.",
      "Pick which Page (and IG account) Rosie should listen on.",
      "Inside Meta Events Manager, configure your dataset id to receive CAPI events from Rosie.",
    ],
    connectPath: "/settings#ad-platforms",
    docsUrl: "https://developers.facebook.com/docs/marketing-apis",
    tags: ["ads", "capi", "lead-forms", "oauth"],
  },
  {
    key: "google_ads",
    name: "Google Ads",
    category: "ads",
    status: "stable",
    tagline: "Spend, ROAS, and offline conversion uploads.",
    description:
      "Pulls campaign + ad-group performance, and uploads offline conversion adjustments when a lead becomes a customer — closing the loop on bidding signals.",
    unlocks: [
      "Paid Ads gauge with Google spend + conversions",
      "Offline conversion uploads via uploadClickConversions",
      "GCLID / GBRAID / WBRAID attribution on landing-page leads",
    ],
    setup: [
      "Settings → Ad platforms → Connect Google Ads.",
      "Apply for developer token + login customer ID in Google Ads API console.",
      "Paste the developer token into Rosie env (one per deployment, not per tenant).",
      "Grant access to the target customer id during OAuth.",
    ],
    connectPath: "/settings#ad-platforms",
    docsUrl: "https://developers.google.com/google-ads/api",
    tags: ["ads", "google", "offline-conversions", "oauth"],
  },
  {
    key: "tiktok",
    name: "TikTok Ads",
    category: "ads",
    status: "beta",
    tagline: "Spend metrics + Events API conversions.",
    description:
      "TikTok Ads Manager spend + delivery metrics in the same gauge as Meta/Google, plus server-side Events API for hashed-email/phone conversion signal back to TikTok's optimizer.",
    unlocks: [
      "TikTok spend rolled into the Paid Ads gauge",
      "Server-side Events API conversions on won leads",
      "TTCLID attribution on landing-page leads",
    ],
    setup: [
      "Create a TikTok for Business developer app.",
      "Settings → Ad platforms → Connect TikTok.",
      "Set up an Events API pixel in TikTok Events Manager and paste the pixel id into Rosie.",
    ],
    connectPath: "/settings#ad-platforms",
    docsUrl: "https://business-api.tiktok.com/portal/docs",
    tags: ["ads", "tiktok", "events-api"],
  },
  {
    key: "google_business_profile",
    name: "Google Business Profile",
    category: "search",
    status: "stable",
    tagline: "Profile completeness, reviews, posts, Q&A.",
    description:
      "Reads your Google Business Profile to surface profile gaps in the GBP gauge, ingests new reviews, and lets Rosie respond to them or schedule weekly GBP posts on your behalf.",
    unlocks: [
      "GBP completeness gauge",
      "Inbound review monitoring in /gbp",
      "AI-drafted review responses",
      "Scheduled GBP posts from /posts",
    ],
    setup: [
      "Settings → Integrations → Connect Google.",
      "Grant the business.manage scope on your locations.",
      "Pick which location(s) Rosie should manage.",
    ],
    connectPath: "/settings",
    docsUrl: "https://developers.google.com/my-business",
    tags: ["gbp", "reviews", "seo", "oauth"],
  },
  {
    key: "stripe",
    name: "Stripe",
    category: "billing",
    status: "stable",
    tagline: "Subscription + metered usage billing.",
    description:
      "Powers Rosie's billing: subscription plans, prorated upgrades, customer portal links, and metered usage reporting for messages + AI calls beyond the plan allotment.",
    unlocks: [
      "Plan checkout + customer portal",
      "Usage-based billing for over-allotment",
      "Webhook-driven subscription state",
    ],
    setup: [
      "Set STRIPE_SECRET_KEY in the deployment env.",
      "Create products + prices in Stripe matching your plan tiers.",
      "Add the webhook endpoint /api/webhooks/stripe and paste the signing secret into env.",
    ],
    connectPath: "/billing",
    docsUrl: "https://stripe.com/docs",
    tags: ["billing", "subscription", "usage"],
  },
  {
    key: "make",
    name: "Make.com",
    category: "automation",
    status: "stable",
    tagline: "Automation bridge for any custom lead source.",
    description:
      "Use Make to glue any third-party form / CRM / spreadsheet into Rosie. POST a normalized payload to the lead webhook and Rosie ingests it as a New-stage lead with full attribution.",
    unlocks: [
      "Custom lead-source intake",
      "Easy migration from existing form tools",
      "Per-tenant signing-secret protection on the webhook",
    ],
    setup: [
      "Settings → Integrations → Make.com → reveal the webhook URL.",
      "Optionally generate a signing secret and add it to your Make HTTP module headers.",
      "Map your incoming fields to `{name, phone, email, source, metadata}`.",
    ],
    connectPath: "/settings",
    docsUrl: "https://www.make.com/en/help",
    tags: ["webhooks", "no-code", "custom"],
  },
  {
    key: "anthropic",
    name: "Anthropic Claude",
    category: "ai",
    status: "stable",
    tagline: "AI brains: strategy, drafting, agentic Auto-Rosie.",
    description:
      "Rosie's AI work is powered by Claude. Opus 4.7 plans strategy, Sonnet 4.6 drafts replies + posts, Haiku 4.5 handles cheap detection / translation / classification.",
    unlocks: [
      "Auto-Rosie agentic action plan",
      "Suggest-reply + draft tools across the app",
      "Inbound language detection + translation",
    ],
    setup: [
      "Set ANTHROPIC_API_KEY in deployment env.",
      "Optionally override model choices via env (ROSIE_MODEL_STRATEGY, etc.).",
    ],
    docsUrl: "https://docs.anthropic.com",
    tags: ["ai", "claude", "opus", "sonnet", "haiku"],
  },
  {
    key: "tinybird",
    name: "Tinybird",
    category: "analytics",
    status: "stable",
    tagline: "ClickHouse-scale event store for analytics rollups.",
    description:
      "Tinybird is the read-path for high-volume telemetry: QR scans, page views, usage events. Postgres remains authoritative; Tinybird gives you fast aggregations over millions of rows.",
    unlocks: [
      "Real-time KPIs even with millions of events",
      "Cheap historical aggregations",
      "Dual-write from `recordUsage()` — free for every existing call site",
    ],
    setup: [
      "Create a Tinybird workspace.",
      "Paste the three datasource schemas from `lib/tinybird.ts` into the Tinybird UI.",
      "Set TINYBIRD_TOKEN in env — it auto-enables ingest.",
    ],
    docsUrl: "https://www.tinybird.co/docs",
    tags: ["analytics", "clickhouse", "events"],
  },
  {
    key: "supabase",
    name: "Supabase",
    category: "automation",
    status: "stable",
    tagline: "Database, auth, storage, realtime.",
    description:
      "Rosie's foundation: Postgres with RLS, Supabase Auth for operators, Storage for creatives + logos + recordings, Realtime for the inbox.",
    unlocks: [
      "Multi-tenant RLS-isolated Postgres",
      "Email-link operator auth",
      "Realtime inbox + presence",
      "Direct Storage uploads for branding + creatives",
    ],
    setup: [
      "Self-hosted: run the migrations under `packages/db/migrations/sql/`.",
      "Set DATABASE_URL + SUPABASE_URL + service-role key in env.",
    ],
    docsUrl: "https://supabase.com/docs",
    tags: ["database", "auth", "storage"],
  },
  {
    key: "higgsfield",
    name: "Higgsfield",
    category: "ai",
    status: "beta",
    tagline: "AI image + video generation for ads + posts.",
    description:
      "Higgsfield surfaces inside the Image Creator. Use it to generate ad creatives + social posts without leaving Rosie. Virality prediction available for video creatives before launch.",
    unlocks: [
      "AI image gen in /images",
      "AI video gen for ad creatives",
      "Virality prediction on draft video",
    ],
    setup: [
      "Connect the Higgsfield MCP server in your deployment.",
      "Workspaces inherit from the connected MCP — pick one per tenant.",
    ],
    docsUrl: "https://higgsfield.ai",
    tags: ["ai", "image", "video"],
  },
];

export function findIntegration(key: string): IntegrationDef | undefined {
  return INTEGRATIONS.find((i) => i.key === key);
}

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  messaging: "Messaging",
  voice: "Voice",
  ads: "Ads platforms",
  crm: "CRM",
  automation: "Automation",
  search: "Search & local SEO",
  billing: "Billing",
  ai: "AI",
  analytics: "Analytics",
};

export const STATUS_BADGES: Record<IntegrationStatus, string> = {
  stable: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
  beta: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  alpha: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100",
  planned: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
};
