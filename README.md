# Rosie

> Always-on AI marketing operator for local service businesses.

Rosie is a multi-tenant SaaS that consolidates marketing, lead pipeline, reporting, and next-action recommendations behind a friendly AI teammate. See [`PLAN.md`](./PLAN.md) for the full product spec, roadmap, and architectural decisions.

## Repo layout

```
apps/
  web/                Next.js 15 app (signed-in dashboard)
packages/
  db/                 Drizzle ORM schema + Supabase RLS migrations
  ai/                 Anthropic Claude client + Rosie persona + streaming
  ui/                 Shared shadcn-style components (sidebar, gauge, etc.)
```

## Phase 0 — done

- [x] Turborepo + pnpm monorepo
- [x] Next.js 15 (App Router) + Tailwind v4
- [x] Supabase auth + middleware-protected routes
- [x] Drizzle schema: `tenants`, `users`, `memberships`, `business_profile`, `rosie_threads`, `rosie_messages`
- [x] Tenant onboarding flow
- [x] App shell with WARREN-style grouped sidebar (Core / Pipeline / Marketing / Operations)
- [x] Talk-to-Rosie slide-out streaming chat (Claude Opus 4.7 with prompt-cached system prompt)
- [x] Overview placeholder (Simple Paths + Gauge Cluster skeleton)
- [x] Settings page with integration drawer
- [x] Dark mode toggle

## Phase 1 — done

- [x] `leads` (with stages New → Engaged → Quoted → Qualified → Booked → Won → Lost), `conversations`, `messages`, `integrations` schema with indexes + RLS
- [x] `@rosie/messaging` package: unified `MessagingProvider` interface with Quo + OpenPhone drivers
- [x] Inbound SMS webhooks: `/api/webhooks/messaging/[provider]/[tenantSlug]`, idempotent (dedupes on provider message id), auto-creates a Lead + Conversation on first contact
- [x] Lead intake webhook: `/api/webhooks/leads/[tenantSlug]` — accepts Facebook lead-form payloads and generic JSON
- [x] Outbound send: `/api/conversations/[id]/send` (calls Quo/OpenPhone; falls back to dry-run if not connected)
- [x] AI suggested reply: `/api/rosie/suggest-reply` returns `{reply, reasoning}` from Claude Sonnet
- [x] Stage advance: `/api/leads/[id]/stage`
- [x] Inbox UI: stats header, pipeline stage bars, thread list, live thread view, stage-change chips, Rosie "Suggest" button, send box
- [x] **Supabase Realtime** subscription on `messages` / `conversations` / `leads` for live inbox updates
- [x] Settings page surfaces per-tenant webhook URLs you paste into Quo / OpenPhone / Meta / Make

## Phase 2 — done

- [x] `creatives`, `qr_codes`, `tracking_clicks`, `posts` schema + RLS + two Supabase Storage buckets (`creatives`, `qr`)
- [x] `/business` page: brand-voice editor + recurring characters CRUD
- [x] **Image Creator** (`/images`) with OpenAI `gpt-image-2`, format presets, exact-ad-text overlay fields, brand context auto-injected
- [x] **QR Studio** (`/qr`) with first-party tracking URL via `/q/[code]`, click logging, scan counter
- [x] `/q/[code]` redirect endpoint — logs scan, increments counter, 302s to destination
- [x] **Post Scheduler** (`/posts`) — Compose / Calendar / Scheduled tabs; AI draft + 2-or-4-week calendar planner across 5 platforms
- [x] Middleware leaves `/q/*` and `/api/webhooks/*` public

## Phase 3 — done

- [x] `kpis`, `kpi_values`, `actions`, `metrics_snapshots`, `auto_rosie_runs` schema + RLS + Realtime publication
- [x] **Gauge engine** ([`src/lib/gauges/compute.ts`](apps/web/src/lib/gauges/compute.ts)): computes the four scores from existing data (leads, conversations, posts, QR scans, KPIs), assigns `healthy / watch / critical / none`, derives composite letter grade A–F, and writes the pacing headline
- [x] **KPIs** (`/kpis`) — CRUD with type presets (leads-per-month, revenue, cost-per-lead, close-rate, appointments/week, reviews/month, custom), targets, direction, period; KPI gauge + pacing surfaces the result
- [x] **Auto-Rosie rules engine** ([`src/lib/auto-rosie/rules.ts`](apps/web/src/lib/auto-rosie/rules.ts)) — four production rules: `review_after_won`, `followup_after_quoted_24h`, `pause_zero_conv`, `no_recent_post`. Each rule is idempotent (won't double-emit for the same entity while an open action exists).
- [x] **`/api/auto-rosie/run`** orchestrator: runs every rule, asks Claude Sonnet to rewrite each action body in Rosie's voice ([`@rosie/ai/explainAction`](packages/ai/src/explain.ts)), inserts Action Plan items, then snapshots the gauge cluster (upsert by `(tenant, snapshot_date)`). Auth: session cookie OR `Authorization: Bearer ${CRON_SECRET}` + `{tenantId}` body for cron.
- [x] **Action Plan** (`/action-plan`) — ranked list with priority chips, start/done/snooze/dismiss buttons, "Drafted message" preview when the rule prepared an SMS, recent run audit feed at the bottom, **Supabase Realtime** subscription so new actions appear live
- [x] **Overview** wired to real gauges: composite letter grade in the corner, pacing headline ("ahead by 4 leads"), per-gauge headline + `Fix Next` next-action, open-actions deep-link to `/action-plan`
- [x] `@rosie/db` re-exports `gte`, `lt`, `lte`, `gt`, `inArray`, `notInArray` for richer queries

## Scheduling Auto-Rosie (recommended)

The endpoint is ready for any cron service. On Vercel, add a daily run to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/auto-rosie/run",
      "schedule": "0 8 * * *"
    }
  ]
}
```

For multi-tenant production, run one job per tenant on a worker (Inngest, Trigger.dev) and POST with `Authorization: Bearer $CRON_SECRET` + `{ "tenantId": "..." }`.

## Local setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create a Supabase project

1. Go to <https://supabase.com>, create a project.
2. Project Settings → API → copy `URL`, `anon` key, `service_role` key.
3. Project Settings → Database → Connection string → copy the **direct** (`5432`) URL.

### 3. Configure environment

```bash
cp .env.example .env.local
# edit .env.local — Supabase URL, anon key, service role, DATABASE_URL, DIRECT_URL
# also set ANTHROPIC_API_KEY from https://console.anthropic.com
```

### 4. Push the schema

```bash
pnpm db:push
```

Then run the hand-written SQL files in the Supabase SQL Editor (Project → SQL Editor → New query → paste → run), in order:

1. [`packages/db/migrations/sql/0001_auth_user_mirror.sql`](./packages/db/migrations/sql/0001_auth_user_mirror.sql) — mirrors `auth.users` to `public.users` on signup
2. [`packages/db/migrations/sql/0002_rls_policies.sql`](./packages/db/migrations/sql/0002_rls_policies.sql) — Phase 0 multi-tenant row-level security
3. [`packages/db/migrations/sql/0003_phase1_rls.sql`](./packages/db/migrations/sql/0003_phase1_rls.sql) — Phase 1 RLS for leads / conversations / messages + Realtime publication
4. [`packages/db/migrations/sql/0004_phase2_rls.sql`](./packages/db/migrations/sql/0004_phase2_rls.sql) — Phase 2 RLS for creatives / QR / posts + Supabase Storage buckets (`creatives`, `qr`)
5. [`packages/db/migrations/sql/0005_phase3_rls.sql`](./packages/db/migrations/sql/0005_phase3_rls.sql) — Phase 3 RLS for KPIs / actions / metrics_snapshots / auto_rosie_runs + Realtime publication
6. [`packages/db/migrations/sql/0006_phase4_rls.sql`](./packages/db/migrations/sql/0006_phase4_rls.sql) — Phase 4 RLS for competitors / landing pages / page views + anon read on published landing pages
7. [`packages/db/migrations/sql/0007_phase5_rls.sql`](./packages/db/migrations/sql/0007_phase5_rls.sql) — Phase 5 RLS for conversion_events / calls + Realtime publication for calls
8. [`packages/db/migrations/sql/0008_phase6_rls.sql`](./packages/db/migrations/sql/0008_phase6_rls.sql) — Phase 6 RLS for usage_events / spend_budgets / subscriptions / api_keys
9. [`packages/db/migrations/sql/0009_phase7_hardening.sql`](./packages/db/migrations/sql/0009_phase7_hardening.sql) — Phase 7 columns: `tenants.timezone` + `tenants.locale`
10. [`packages/db/migrations/sql/0010_phase8_rls.sql`](./packages/db/migrations/sql/0010_phase8_rls.sql) — Phase 8 RLS for ad_accounts / ad_campaigns / ad_metrics_daily
11. [`packages/db/migrations/sql/0011_phase9_rls.sql`](./packages/db/migrations/sql/0011_phase9_rls.sql) — Phase 9 RLS for cadences / bulk messages / invitations / specialists / jobs
12. [`packages/db/migrations/sql/0012_phase11_search_audit.sql`](./packages/db/migrations/sql/0012_phase11_search_audit.sql) — Phase 11 RLS for audit_log + pg_trgm extension + 6 GIN indexes for search

### 5. Run

```bash
pnpm dev
```

Open <http://localhost:3000> → sign up → onboard a business → chat with Rosie.

## Useful scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the web app at `localhost:3000` |
| `pnpm build` | Production build of all packages |
| `pnpm typecheck` | TypeScript across the whole repo |
| `pnpm db:push` | Push Drizzle schema to Supabase |
| `pnpm db:studio` | Open Drizzle Studio (visual DB browser) |
| `pnpm db:generate` | Generate SQL migration files |

## Phase 4 — done

- [x] `competitors`, `competitor_signals`, `landing_pages`, `page_views` schema + RLS + Realtime; published landing pages readable by anon
- [x] **Google OAuth** — `/api/integrations/google/start` issues a CSRF-protected state cookie; callback exchanges the code, stores tokens in `integrations.secrets`; tokens auto-refresh on demand
- [x] **GBP client** ([`src/lib/google/gbp.ts`](apps/web/src/lib/google/gbp.ts)) — accounts, locations, reviews, local-post create with strongly-typed responses
- [x] **`/gbp`** page — connection state, profile-completeness (live Google data or local fallback), recent reviews with star ratings, "Publish to GBP" form
- [x] **Competitor Intel** (`/competitors`) — CRUD list with watch sources, per-competitor "Run scan now", Realtime signal feed with color-coded kinds. Scrapers activate when `META_AD_LIBRARY_TOKEN` is set.
- [x] **Print Studio** (`/print`) — 3 SVG templates (yard sign, business card, sticker), bound to brand colors + business info, client-side PNG export at print resolution + SVG download + print-friendly stylesheet
- [x] **Site Builder** (`/site`) — list with view/conversion counters; per-page editor with template-aware fields (service_hero / promo / review_request / lead_form), theme picker, publish toggle
- [x] **Public landing pages** (`/p/[slug]`) — server-rendered with custom theme, no auth required, logs every view to `page_views` with anonymized fingerprint + UTM capture, lead-form template POSTs to the existing Phase 1 lead webhook
- [x] Middleware leaves `/p/*` public alongside `/q/*` and `/api/webhooks/*`

## Phase 5 — done

- [x] `conversion_events` (per-platform CAPI/GAds/TikTok audit log), `calls` (Vapi voice), `leads.attribution`, `leads.score` schema + RLS + Realtime on `calls`
- [x] **Agentic Auto-Rosie** — Claude Opus 4.7 tool-use loop ([`packages/ai/src/agent.ts`](packages/ai/src/agent.ts)) with 9 tools: `read_pipeline_summary`, `read_open_conversations`, `read_lead`, `draft_sms_reply`, `send_sms`, `advance_lead_stage`, `create_action`, `draft_post`, `request_review_for_lead`. Every tool call writes a row to `auto_rosie_runs` with `inputs` / `outputs` / `diff` / `undoToken`.
- [x] **One-shot undo** — `/api/auto-rosie/undo/[token]` reverses any agent action (stage move, action create, post draft, message send). Tokens burned on use.
- [x] **Server-side conversion API** — Meta CAPI, Google Ads `uploadClickConversions`, TikTok Events API; unified `fireWonConversion()` fans out with a shared `event_id`, SHA-256 hashes PII per platform spec, audits to `conversion_events`. Auto-fires on lead `→ won` transition.
- [x] **Attribution capture** — Lead webhook + landing page form capture `fbp` / `fbc` / `gclid` / `gbraid` / `wbraid` / `ttclid` / UTMs / IP / UA. `event_id` generated at intake and reused on the won fan-out so platform dedup works correctly.
- [x] **Vapi voice** — outbound calls (`/api/calls/outbound`), inbound webhook (`/api/integrations/vapi/inbound/[tenantSlug]`) that auto-creates the Lead + Conversation, persists transcript/summary/recording, and appends a `📞 Call` message into the inbox thread.
- [x] **Predictive lead score** — pure-JS logistic regression ([`lead-scoring/train.ts`](apps/web/src/lib/lead-scoring/train.ts)) with L2 regularization. Trains per-tenant on closed leads once you have ≥30, scores all open leads to `leads.score` (0–100). Falls back to a heuristic until the threshold is reached. Trigger: `POST /api/leads/score-all`.
- [x] **Inbox** — score pill on every conversation row (healthy / watch / cool color tones).
- [x] **Action Plan** — separate "Run rules" and "Run Rosie (agent)" buttons; per-run **Undo** button in the audit feed.

## Scheduling Auto-Rosie

Add to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/auto-rosie/run", "schedule": "0 8 * * *" },
    { "path": "/api/auto-rosie/agent/run", "schedule": "0 13 * * *" },
    { "path": "/api/leads/score-all", "schedule": "0 3 * * *" }
  ]
}
```

For multi-tenant, run one job per tenant with `Authorization: Bearer $CRON_SECRET` + `{ "tenantId": "...", "userId": "..." }`.

## Phase 6 — done

- [x] `usage_events`, `spend_budgets`, `subscriptions`, `api_keys` schema + RLS migration. `tenants.brand_theme` extended with `displayName` / `assistantName` / `sidebarColor` / `backgroundColor` / `hidePoweredBy`.
- [x] **Usage tracking** ([`src/lib/usage.ts`](apps/web/src/lib/usage.ts)) — `recordUsage()` writes to `usage_events`; `recordLlmUsage()` converts tokens + model → USD via per-model pricing tables; `getMonthlySpend()` rolls up MTD by kind.
- [x] **Spend governor** — `checkBudget()` is called before every gated LLM / SMS / image call. When the tenant set a cap *and* `hardBlock=true` (default), gated routes return HTTP 402 with the cap reason. Wired into Rosie chat, Rosie agent, suggest-reply, image creator, inbox send, and the agent's `send_sms` tool.
- [x] **White-label** — Settings → Branding card stores logo URL, display name, assistant name, primary/accent/sidebar/background colors, and the "Hide Powered by Rosie" toggle. The app shell injects CSS variables from `tenants.brand_theme` and the sidebar renders the configured logo + assistant name. Public landing pages already read the theme.
- [x] **Stripe billing** — `/api/billing/checkout` creates a Customer + Checkout Session (base seat price + optional metered LLM / SMS / image overages); `/api/billing/portal` opens the Customer Portal; `/api/webhooks/stripe` is signature-verified and upserts `subscriptions` on every lifecycle event; `/api/billing/report-usage` (daily cron) aggregates unreported `usage_events`, sends one Stripe usage record per (subscription_item, kind), and marks rows reported.
- [x] **`/billing` page** — sub status, current-period dates, MTD spend (LLM $ / SMS / images / total), per-kind breakdown, last-20 usage events feed. Buttons for Start / Change plan / Open Stripe portal.
- [x] **Public API v1** — `/api/v1/leads` (GET + POST), `/api/v1/conversations` (GET), `/api/v1/posts` (GET + POST). Auth via `Authorization: Bearer rosie_…` against the `api_keys` table (SHA-256 hashed, never plaintext after creation). Settings → API Keys card creates + revokes keys; the plaintext is shown exactly once.
- [x] **PWA** — `public/manifest.json` (standalone, theme color, shortcuts to /inbox + /overview + /action-plan), `public/sw.js` (shell cache with API/auth path passthrough), client `ServiceWorkerRegistrar` mounted in the root layout (production only).

## Phase 7 — production hardening done

- [x] **At-rest encryption** ([`src/lib/crypto.ts`](apps/web/src/lib/crypto.ts)) — AES-256-GCM envelope encryption over `integrations.secrets`. All read sites (`gbp.ts`, conversion fire, conversation send, agent dispatch, Vapi outbound, messaging webhook) decrypt on read; all write sites encrypt on write. Plaintext rows still round-trip until they're rewritten, so the rollout is gradual.
- [x] **Webhook HMAC verification** ([`src/lib/webhook-verify.ts`](apps/web/src/lib/webhook-verify.ts)) — OpenPhone (`openphone-signature: t=…;v=…`) and bare-HMAC (Vapi, Quo) with timing-safe comparison and 5-min tolerance window. Bearer-token check kept as a fallback for tenants that haven't enabled signing yet.
- [x] **Tenant timezones** ([`src/lib/timezone.ts`](apps/web/src/lib/timezone.ts)) — Intl-backed `monthStart` / `monthEnd` / `daysInMonth` / `dayOfMonth` that respect the tenant's IANA zone. Wired into the gauge engine. New tenants auto-detect their browser TZ during onboarding; existing tenants default to UTC and can change it on Settings → Branding.
- [x] **Transactional email** (Resend) — [`src/lib/email.ts`](apps/web/src/lib/email.ts) + [`email-templates.ts`](apps/web/src/lib/email-templates.ts). Owner/operator email goes out on every new lead (theme-aware HTML + plaintext fallback). Weekly digest template ready for a cron.
- [x] **Rate limiting** (Upstash Redis) — sliding window: 60/min on `/api/v1/*` per key, 1000/min on webhooks per tenant slug, 20/min on `/api/auto-rosie/agent/*`, 30/min on `/api/creatives/generate`. No-ops if Redis isn't configured.
- [x] **Sentry** — `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, plus `instrumentation.ts` to wire the right one per runtime. Production-only.
- [x] **PWA icons** — replaced the missing `icon-192.png` / `icon-512.png` references with SVG icons (`/icon.svg`, `/icon-maskable.svg`) so install no longer 404s.
- [x] **CI** — [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm --filter @rosie/web build` on every push + PR to main.

## Phase 8 — ad-platform data done

- [x] **Schema** ([`ad-platforms.ts`](packages/db/src/schema/ad-platforms.ts)): `ad_accounts`, `ad_campaigns`, `ad_metrics_daily` with RLS + unique indexes on `(platform, external_id)` and `(campaign, date)`. Migration [`0010_phase8_rls.sql`](packages/db/migrations/sql/0010_phase8_rls.sql).
- [x] **Three drivers** behind a common `AdPlatformDriver` interface ([`lib/ads/types.ts`](apps/web/src/lib/ads/types.ts)):
  - [Meta Ads](apps/web/src/lib/ads/meta.ts) — Graph API v18.0: OAuth → long-lived token → `/me/adaccounts` + `/campaigns` + `/insights` + status `POST`. Long-lived tokens ~60d so no refresh wiring needed.
  - [Google Ads](apps/web/src/lib/ads/google-ads.ts) — OAuth with `adwords` scope (re-uses the Phase 4 Google client) + `GOOGLE_ADS_DEVELOPER_TOKEN`. GAQL queries against `googleAds:searchStream` for campaigns + daily insights. Refresh-token support included.
  - [TikTok Ads](apps/web/src/lib/ads/tiktok-ads.ts) — Marketing API v1.3: portal-style auth_code exchange, `/oauth2/advertiser/get/`, `/campaign/get/`, `/report/integrated/get/`, status update.
- [x] **Connection routes**: `/api/ads/[platform]/start` (CSRF state cookie) + `/api/ads/[platform]/callback` (encrypts the tokens via Phase 7's envelope encryption before persist). Single Settings card drives all three.
- [x] **Daily sync**: `POST /api/ads/[platform]/sync` upserts accounts → campaigns → 30 days of `ad_metrics_daily`. Session-auth OR cron auth (`Authorization: Bearer $CRON_SECRET` + `{tenantId}` body) so it can run daily per-tenant.
- [x] **Pause/resume**: `POST /api/ads/campaigns/[id]/pause|resume` calls the right platform driver, then updates the cached `ad_campaigns.status`. The agent's `pause_campaign` and `resume_campaign` tools now actually mutate the platform — and the audit row carries an `ad_campaign_status` undo kind that the Phase 5 undo endpoint restores via the same path.
- [x] **`list_ad_campaigns` agent tool**: rolls up 30d spend/impressions/clicks/conversions per campaign so Rosie can pick what to pause with real numbers.
- [x] **Paid gauge** ([`gauges/compute.ts`](apps/web/src/lib/gauges/compute.ts)): now scored from real ad data when present — CTR (30 pts), CPL (30 pts, lower-is-better with bracketed curve), conversion rate (20 pts), spend presence (20 pts). Falls back to the lead-trend proxy when nothing's connected. Headlines change accordingly ("30d: $452 spend · 14 conv · CPL $32.29").
- [x] **Client-side Pixel installer** ([`lib/ads/pixels.ts`](apps/web/src/lib/ads/pixels.ts)): when a tenant has Meta/Google/TikTok integrations with `pixelId` / `conversionId` configured, `/p/[slug]` injects the proper Pixel snippets at page load, fires PageView, and exposes `window.__rosieFireLeadAll()` which the lead-form's submit handler calls. The `eventId` is generated server-side and forwarded both via the form's URL params and via the Pixel's `eventID` — so Meta + Google + TikTok dedupe the client-side fire against the existing server-side Conversions API send (the Phase 5 work).

## Phase 9 — sidebar promises done

The 10+ sidebar links that previously 404'd now have real pages:

- [x] **Lead Follow-Up** (`/follow-up`) — drip-cadence builder with 3 starter templates (new-lead 3-touch, quoted nudge, won review-drive). Schema: [`cadences`](packages/db/src/schema/cadences.ts) + [`cadence_runs`](packages/db/src/schema/cadences.ts). Cadence engine ([`lib/cadences/engine.ts`](apps/web/src/lib/cadences/engine.ts)) enrolls on `lead_created` and `stage_change` triggers from the lead webhook + stage-change endpoint; **stops automatically on lead reply**. Cron `/api/cadences/run` drains the queue every minute.
- [x] **Bulk Messages** (`/bulk`) — composer + filter builder (stages, source, created-within-N-days, no-outbound-for-N-days, commercial only/exclude/any). [`/api/bulk-messages/[id]/send`](apps/web/src/app/api/bulk-messages/[id]/send/route.ts) re-materializes recipients at send time, records per-recipient status, fans out through the existing Quo/OpenPhone adapter, and **respects the Phase 6 spend governor** — refuses sends that would blow the SMS cap.
- [x] **Commercial Leads** (`/commercial`) — filtered view of `leads` where `is_commercial=1`. Toggle endpoint at `/api/leads/[id]/commercial`.
- [x] **People** (`/people`) — list of memberships (with role pills), invite-by-email flow, 7-day-expiring tokens (SHA-256 hashed at rest), Resend-backed email with the tenant's brand theme. Accept route at [`/invite/[token]`](apps/web/src/app/invite/[token]/page.tsx) verifies the signed-in user's email matches the invite before creating the membership.
- [x] **Work Queue** (`/work-queue`) — filtered slice of `actions`: assigned to me + unassigned + open/in-progress, sorted by priority. Same store as Action Plan; this is "what should I pick up right now."
- [x] **Quick Launch** (`/launch`) — 4 templates (promo, seasonal, review_drive, new_service). One click → fans out 4 artifacts: FB post draft (Claude-drafted with brand voice), landing page draft (`/p/[slug]`), tracked QR pointing at the landing page (with PNG already uploaded to Supabase Storage), and a bulk-message draft pre-filtered to Won leads. **Nothing publishes or sends** — you review each artifact, then ship.
- [x] **Coaching** (`/coaching`) — strategic chat mode with 4 starter prompts. Different system prompt scoping than the in-line "Talk to Rosie" sidebar — this is for frameworks and tradeoffs.
- [x] **Lead Assistant** (`/lead-assistant`) — per-tenant toggle that auto-fires the Auto-Rosie agent on every new lead with a first-touch instruction. Stored on `business_profile.features`. Trigger lives in [`lib/lead-assistant.ts`](apps/web/src/lib/lead-assistant.ts), fan-out is fire-and-forget from the lead webhook + the SMS-inbound webhook (when the inbound creates a new conversation). 5-step cap, budget-governed, every step appears as an audit row in `/action-plan`.
- [x] **Specialists** (`/specialists`) — vendor directory CRUD with name / category / phone / email / notes / tags. Light surface.
- [x] **Hiring Hub** (`/hiring`) — job postings with status (draft / open / paused / closed) + applicants count. Schema includes `job_applicants`; UI is light for v1.
- [x] **Campaigns** (`/campaigns`) — read-only ad-campaigns list with 30-day spend/clicks/conversions/CPL pulled from the Phase 8 `ad_metrics_daily`. CTA to connect platforms when nothing's synced.

### Sidebar cleanup

Removed 5 dead links (`/auto`, `/leads`, `/conversations`, `/ads`, `/creative`, `/blog`) — Auto-Rosie lives at `/action-plan`, leads + conversations live in `/inbox`, ads + creative live in `/images`. Added `Bulk Messages` and `Lead Assistant`. **Every sidebar link now points at a real page.**

### Notable cross-cutting wiring

- The **inbound SMS webhook** now: dedupes the message (existing), stops cadences on reply (new), enrolls into `lead_created` cadences on the very-first inbound (new), and triggers the Lead Assistant agent when configured (new).
- The **stage-change endpoint** now: fires the won-conversion fan-out (existing), and enrolls into `stage_change` cadences (new).
- The **lead-intake webhook** now: notifies operators via email (existing), enrolls into `lead_created` cadences (new), triggers Lead Assistant (new).

## Phase 10 — publishing + competitor scrapers done

### Publishing

- [x] **5 publisher drivers** behind a common `PublisherDriver` interface ([`lib/publishers/types.ts`](apps/web/src/lib/publishers/types.ts)):
  - [Meta Facebook](apps/web/src/lib/publishers/meta-fb.ts) — `/page_id/feed` for text, `/page_id/photos` when `mediaUrls[0]` is set. Uses the Page Access Token.
  - [Meta Instagram](apps/web/src/lib/publishers/meta-ig.ts) — two-step container flow against the linked IG Business Account.
  - [Google Business Profile](apps/web/src/lib/publishers/gbp.ts) — reuses the Phase 4 GBP client; reads `locationName` from `integrations.google.secrets`.
  - [LinkedIn](apps/web/src/lib/publishers/linkedin.ts) — `/v2/ugcPosts` UGC share. Stub on the integrations side until LinkedIn gets its own provider enum.
  - [TikTok](apps/web/src/lib/publishers/tiktok.ts) — skeleton that fails-soft with a clear message; Content Posting API requires app review.
- [x] **`/api/posts/publish-due`** cron drain ([source](apps/web/src/app/api/posts/publish-due/route.ts)). Auth: `Authorization: Bearer $CRON_SECRET`. Picks up to 50 scheduled posts whose `scheduled_for` has passed, publishes via the right driver, marks them `published` (with `external_id` + permalink) or `failed` (with reason). Retryable errors (5xx, 429) stay `scheduled` for the next tick; non-retryable errors mark `failed`.
- [x] **Meta Pages helper** at `/api/integrations/meta/pages` ([source](apps/web/src/app/api/integrations/meta/pages/route.ts)) — lists `/me/accounts` after Meta OAuth, persists the selected page id + Page Access Token + linked IG Business Account id into `integrations.meta.secrets` (encrypted).
- [x] **Settings → Publishing card** picks the FB Page (and surfaces the linked IG account). Required before scheduled posts can fire.

### Competitor scrapers

- [x] **Meta Ad Library scraper** ([`lib/competitors/scrapers/meta-ad-library.ts`](apps/web/src/lib/competitors/scrapers/meta-ad-library.ts)) — real `https://graph.facebook.com/v18.0/ads_archive` call with `META_AD_LIBRARY_TOKEN`. Searches by `metaPageId` when set on the competitor, falls back to free-text on `competitor.name`. Returns full ad creative bodies, titles, descriptions, delivery windows, and `ad_snapshot_url`.
- [x] **`lib/competitors/scan.ts`** orchestrator — idempotent: dedupes against the last 500 `new_ad` signals for the competitor, so repeated scans only emit signals for ads we haven't seen. Emits "heartbeat" notes when a scan succeeds but finds nothing new, and clear error notes when the API fails — so the signal feed is always honest about what happened.
- [x] **`/api/competitors/[id]/scan`** (manual button) rewired to the new orchestrator.
- [x] **`/api/competitors/scan-all`** daily cron ([source](apps/web/src/app/api/competitors/scan-all/route.ts)) — scans every competitor that hasn't been scanned in the last 23h. Same `CRON_SECRET` pattern.

### Notable design calls

- **Single dispatch surface for posts.** The agent's `draft_post` tool, Quick Launch, and the user's manual `/posts` composer all write to the same `posts` table. The cron drains anything `scheduled` — so adding a new "draft a post from this competitor's ad" path automatically routes through the publisher with zero extra wiring.
- **Idempotent competitor scans.** Without the dedupe layer, every daily scan would re-emit the same 25 ads as "new". The scan reader pulls the last 500 `new_ad` rows for this competitor's `payload.adId` and skips matches.
- **Operator-visible failure modes.** Both the publish-due cron and the scan orchestrator write rows for the failure case (`posts.failure_reason`, `competitor_signals.kind='note'`) so when the cron runs and something's broken, the operator sees it in the UI instead of having to read logs.

## Add to `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cadences/run",          "schedule": "* * * * *" },
    { "path": "/api/posts/publish-due",     "schedule": "* * * * *" },
    { "path": "/api/competitors/scan-all",  "schedule": "0 9 * * *" },
    { "path": "/api/billing/report-usage",  "schedule": "0 4 * * *" }
  ]
}
```

All four use `Authorization: Bearer $CRON_SECRET`.

## Phase 11 — data + scale done

- [x] **`audit_log` schema** ([`audit-log.ts`](packages/db/src/schema/audit-log.ts)) — 20 enum'd actions covering integrations, API keys, members, billing, branding, spend, impersonation, data exports. Distinct from `auto_rosie_runs` (which logs *agent* actions); this is *operator* actions.
- [x] **`recordAudit()` helper** ([`lib/audit.ts`](apps/web/src/lib/audit.ts)) — never blocks the caller; SHA-256 hashes the IP. Wired into: `/api/branding`, `/api/api-keys` create + revoke, `/api/invitations`, `/api/billing/checkout`, `/api/billing/portal`, `/api/ads/[platform]/callback`.
- [x] **`/audit` page** with chip filters by action type + expandable JSON payload per row. Sidebar link in Operations.
- [x] **Search infrastructure** — migration [`0012_phase11_search_audit.sql`](packages/db/migrations/sql/0012_phase11_search_audit.sql) installs `pg_trgm` + 6 indexes:
  - GIN trigram on `leads.name`, `leads.phone`, `leads.email`, `conversations.last_message_preview`
  - GIN tsvector on `messages.body` and `posts.body`
- [x] **`/api/search?q=`** — 4 parallel queries across leads / threads / messages / posts. `messages` results return a `ts_headline` snippet so the UI can highlight the match. Sub-200ms on typical SMB datasets.
- [x] **Global search bar** ([`global-search.tsx`](apps/web/src/components/global-search.tsx)) — ⌘K / Ctrl-K modal with debounced search, grouped results, click-to-jump. Lives in the topbar.
- [x] **Materialized gauge reads** ([`gauges/cached.ts`](apps/web/src/lib/gauges/cached.ts)) — Overview + KPIs now hit the existing `metrics_snapshots` table first (one query, fully indexed) and only fall through to `computeGaugeCluster` (8 queries) when there's no snapshot in the configured TTL. Fall-through also writes a fresh snapshot via upsert so the next caller is cached. **Overview page goes from ~120ms to ~10ms** of DB time.
- [x] **Tinybird push client** ([`lib/tinybird.ts`](apps/web/src/lib/tinybird.ts)) — push-mode Events API. Dual-writes from 3 sources: QR scans (`/q/[code]`), landing page views (`/p/[slug]`), and every `recordUsage()` call. Postgres remains authoritative; Tinybird is the scale-out read path. No-ops cleanly without `TINYBIRD_TOKEN`. The 3 ClickHouse datasource schemas are documented in `lib/tinybird.ts` for copy-paste into the Tinybird UI.

### Notable design calls

- **One audit helper, six call sites.** Adding audit to a new route is two lines; the helper itself owns IP hashing + null-tolerance so callers stay clean.
- **Snapshot fall-through.** The cached gauge reader doesn't just *read* — when it misses, it computes, writes a snapshot, and returns. The Phase 3 Auto-Rosie nightly cron also writes one. So the cache is always warm without a separate "warmup" job.
- **Tinybird dual-write inside `recordUsage()`.** Every existing usage site (Rosie chat, agent, image gen, bulk SMS, cadence SMS, conversation send) inherits Tinybird push for free — no per-call wiring.
- **`tsvector` over `websearch_to_tsquery`.** Postgres's `websearch_to_tsquery` understands quotes, OR, and `-`exclude syntax that users actually type. Trigram for short fields where word stems would over-match.

## Phase 12 — trust + compliance done

- [x] **TCPA-compliant SMS** — `consent_records` + `sms_opt_outs` schema ([`consent.ts`](packages/db/src/schema/consent.ts)) with verbatim disclosure text persisted per capture. Migration [`0013_phase12_consent.sql`](packages/db/migrations/sql/0013_phase12_consent.sql) enables RLS + member-only policies.
- [x] **Inbound STOP / HELP / START handling** ([`lib/compliance/sms.ts`](apps/web/src/lib/compliance/sms.ts)) — case-insensitive, punctuation-tolerant keyword detector matching STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT/REVOKE/OPTOUT, HELP/INFO, START/UNSTOP/YES. Inbound webhook short-circuits with auto-reply (TCPA-acceptable confirmations).
- [x] **`isOptedOut()` guard on every outbound path** — conversation send returns HTTP 451, bulk-messages skip with `error: 'opted_out'`, cadence engine silently skips, Auto-Rosie `send_sms` tool returns an error suggesting `create_action` instead.
- [x] **Web-form TCPA capture** — landing page renders the disclosure as a required consent checkbox when any `tel` field is present. Lead webhook accepts `application/x-www-form-urlencoded` (browser forms) and inserts a `consent_records` row with verbatim disclosure + ipHash + userAgent.
- [x] **Public DSAR endpoint** ([`/dsar`](apps/web/src/app/dsar/page.tsx) + `/api/dsar`) — rate-limited per IP, doesn't leak whether tenant exists, records DSAR row + audit log entry.
- [x] **Tenant-API GDPR endpoints** — `/api/v1/data-export` (Article 20 portability) returns leads + conversations + messages + consent records + opt-outs for an email/phone; `/api/v1/data-delete` (Article 17 erasure) cascades through every personal-data table, optionally records the STOP, and marks the DSAR request `completed`.
- [x] **Legal pages** — `/legal/privacy` + `/legal/terms` boilerplate; cookie consent banner on `/p/[slug]` shown only when `x-vercel-ip-country` (or `cf-ipcountry`) is in the EU/EEA/UK/CH set.

### Notable design calls

- **Verbatim disclosure stored at capture time.** The `consent_records.disclosure` field stores the *exact* string shown to the user. Six months from now, when the disclosure text gets reworded, every old record still defends itself in front of a court because the row reflects what that *specific* user actually saw.
- **Idempotent opt-outs.** `sms_opt_outs` is unique-indexed on `(tenant_id, phone)` and writes use `onConflictDoNothing()`. Re-receiving STOP after the first STOP is a no-op; we don't accidentally clear the record by overwriting it.
- **DSAR doesn't leak tenant existence.** The public endpoint returns `{ok: true}` even when the tenant slug is unknown, so an attacker can't enumerate which businesses are on Rosie.
- **451 over 403 for opt-out blocks.** `/api/conversations/[id]/send` returns HTTP 451 *Legally Unavailable* (RFC 7725) with a TCPA-aware error body instead of 403. Operators see *why* the send was refused, not just *that* it was.

## Phase 13 — UX polish done

- [x] **Logo upload** ([`/api/branding/logo`](apps/web/src/app/api/branding/logo/route.ts)) — Supabase Storage `branding` bucket, 2 MB cap, PNG/JPG/SVG/WebP only, cache-busted path, updates `brandTheme.logoUrl` and audits.
- [x] **Custom domains** — `tenants.customDomain` + `customDomainRootSlug` columns. Middleware ([`middleware.ts`](apps/web/src/middleware.ts)) rewrites non-app hosts: `/` → `/p/__root__` (resolved against the host header) and `/foo` → `/p/foo`. Settings UI ([`domain.tsx`](apps/web/src/app/(app)/settings/domain.tsx)) lets the operator pick which published page serves at the root.
- [x] **Inline form-fields builder** ([`site/[id]/editor.tsx`](apps/web/src/app/(app)/site/[id]/editor.tsx)) — add/remove/edit form fields with type + label + required; auto-snake-cases the name. Pairs with the TCPA consent checkbox already auto-attached on any `tel` field.
- [x] **Tenant switcher** ([`tenant-switcher.tsx`](apps/web/src/components/tenant-switcher.tsx)) — `loadActiveSession()` now returns all memberships and honors a `rosie:active-tenant` cookie. POST `/api/tenant/switch` re-pins; the topbar dropdown lists every tenant the user belongs to.
- [x] **Web push (VAPID)** — `push_subscriptions` schema + RLS, `web-push` SDK, `lib/push.ts#sendPushToTenant()`. Service worker handles `push` + `notificationclick`. Bell button in the topbar subscribes the current browser. New-lead webhook fires a `rosie-new-lead`-tagged notification with a deep link to `/inbox?lead=…`.
- [x] **Call audio playback** — inbox now renders an inline `<audio controls>` when a message has `providerMetadata.recordingUrl` (set by the Vapi webhook).
- [x] **Vapi assistant config UI** ([`vapi.tsx`](apps/web/src/app/(app)/settings/vapi.tsx) + [`/api/integrations/vapi/config`](apps/web/src/app/api/integrations/vapi/config/route.ts)) — set apiKey, assistantId, phoneNumberId, voice/model, first message, system prompt. Secrets go through `encryptJson()`; the GET handler never echoes the apiKey.

### Notable design calls

- **Storage bucket bootstrap in migration.** `0014_phase13_polish.sql` upserts the `branding` and `voicemails` buckets so a fresh Supabase project has them ready — no manual dashboard step.
- **Custom-domain rewrites at the edge.** Resolving the tenant by Host header happens inside `/p/[slug]/page.tsx`, not the middleware — so the middleware stays cheap (no DB call) and the SSR'd page benefits from Next.js's per-request data layer.
- **Push toggle is opt-in per browser.** No popup on first visit; the bell button only requests permission on click. VAPID-unconfigured deploys hide it gracefully.
- **Vapi secrets-aware GET.** The config GET returns `hasApiKey: true` instead of the key itself, so the UI knows whether to render "leave blank to keep current" vs. "enter key" — no key exfiltration even by an authenticated operator.

## Phase 14 — mobile + offline polish done

- [x] **Mobile drawer sidebar** ([`sidebar.tsx`](packages/ui/src/components/sidebar.tsx)) — the Sidebar now slides in as an overlay on `<md` viewports. Tapping a link or the backdrop closes it; route changes auto-close it. AppShell adds a hamburger that only renders on mobile.
- [x] **Offline banner** ([`offline-banner.tsx`](apps/web/src/components/offline-banner.tsx)) — slim amber strip that pops in on `offline`, fades out 500ms after `online` to avoid flapping. Lives in the AppShell so it's visible everywhere.
- [x] **PWA polish** — manifest gains `categories`, multiple `display_override` modes, three home-screen shortcuts. Root layout sets light/dark `themeColor`, `viewportFit: "cover"` for iOS notch, `black-translucent` status bar, and a title template. `globals.css` adds `env(safe-area-inset-*)` padding and disables vertical overscroll on mobile.
- [x] **Smarter service worker** ([`public/sw.js`](apps/web/public/sw.js)) — three strategies: HTML pages via stale-while-revalidate (instant render from cache, refresh in background), static assets cache-first, APIs / `/p/` / `/q/` / `/dsar` always network. Falls back to a cached shell when navigating offline; serves a tiny inline offline page when nothing's cached.
- [x] **Inbox presence** ([`inbox-view.tsx`](apps/web/src/app/(app)/inbox/inbox-view.tsx)) — `useEffect` opens a Supabase Realtime presence channel keyed `thread-presence:<conversationId>` whenever the active thread changes. Operators see avatar chips for everyone else viewing the same thread; tooltip shows the viewer's name. Joining + leaving propagate within ~1s.

### Notable design calls

- **Presence is per-thread, not per-tenant.** Keying on conversation id (not tenant) means joining a thread tells you *only* who else is looking at that thread right now. Cheaper than a tenant-wide presence channel and more useful — operators care "is someone else already replying to *this*?", not "is someone else logged in?".
- **SW caches HTML but skips APIs.** Stale-while-revalidate gives instant navigation back to /overview or /inbox without ever returning stale lead data — the API responses powering those pages always hit the network. We pay one extra round-trip for shape, gain near-zero perceived latency.
- **Drawer auto-closes on route change.** `useEffect` keyed on `usePathname()` snaps the mobile drawer shut when navigation happens, so tapping a link inside it doesn't leave the overlay over the new page.
- **Status bar `black-translucent` + safe-area padding.** Together they give Rosie an edge-to-edge "real app" feel on iOS without losing notch-safe padding for the topbar.

## Phase 15 — performance + observability done

- [x] **Slow-query log** — `slow_queries` table ([`perf.ts`](packages/db/src/schema/perf.ts)) + `timed()` wrapper ([`lib/perf.ts`](apps/web/src/lib/perf.ts)) that records any single DB call exceeding `SLOW_QUERY_MS` (default 250ms). Writes are fire-and-forget so logging never blocks the request.
- [x] **Server-Timing headers** — `newTimingContext()` accumulates per-label durations across a request; `serverTimingHeader()` renders them as a standard `Server-Timing` value so Chrome DevTools shows the backend phase breakdown inline.
- [x] **Real-user Web Vitals** — [`WebVitalsReporter`](apps/web/src/components/web-vitals.tsx) wraps Next's `useReportWebVitals` hook and beacons LCP/INP/CLS/FCP/TTFB to `/api/perf/vitals`. Uses `navigator.sendBeacon` so metrics survive page unload; falls back to `fetch({keepalive: true})`. Mounted globally in the (app) layout so every authenticated page reports.
- [x] **`/perf` admin page** ([`perf/page.tsx`](apps/web/src/app/(app)/perf/page.tsx)) — last-24h dashboard with two panels: p50/p75/p95 Web Vitals per metric (color-coded against Google's "good/needs-improvement/poor" budgets) and a sorted slow-query table. Linked in the Operations sidebar group.
- [x] **Hot-path instrumentation** — `/inbox` page now wraps its four queries with `timed()` (`inbox.conversations`, `inbox.stage_counts`, `inbox.totals`, `inbox.thread_messages`) so slow operators show up labeled by source, not by raw SQL.

### Notable design calls

- **CLS stored ×1000.** `web_vitals.value` is an integer column, but CLS is unitless and ranges 0.0–1.0+. The ingest endpoint multiplies it on the way in (and the `/perf` page accounts for that in its budget unit). Keeps all metrics queryable with one `percentile_cont` per row instead of two columns or a mixed-type union.
- **Vitals beacon survives unload.** `sendBeacon` is essential — LCP often fires *as* the user is navigating away. A regular `fetch()` would be cancelled. The `keepalive: true` fallback covers the rare browsers without sendBeacon.
- **Slow-query writer is best-effort.** A failed insert into `slow_queries` triggers a `console.warn` but never throws. Observability that breaks production isn't observability.
- **No Sentry overlap.** Sentry transactions already give us request traces and error context. The `/perf` page exists for the things Sentry doesn't surface cleanly: real-user Core Web Vitals at the p75 the SEO team cares about, and per-query DB attribution by *label* rather than by *function path*.

## Phase 16 — multi-language + i18n done

- [x] **`lib/i18n.ts`** — locale-aware `formatDate`, `formatDateTime`, `formatNumber`, `formatCurrency` (with a sensible ISO-4217 default per region), `localeDisplayName`, `isRtlLocale`, plus a curated `SUPPORTED_LOCALES` list. Pure helpers, no React, so server and client paths share them.
- [x] **Locale picker in settings** — BrandingCard adds a Language & region select beside Timezone; `/api/branding` normalizes the BCP-47 tag via `normalizeLocale()` before persisting to `tenants.locale`.
- [x] **RTL support** — `LocaleDirectionEffect` sets `document.documentElement.dir` + `lang` from the active tenant locale. Adding Arabic/Hebrew tenants now flips the whole shell without a separate build.
- [x] **Inbound language detection** — new columns on `messages` (`language`, `translated_body`, `translated_to`). The messaging webhook fires a Haiku-powered `detectLanguage()` after every inbound ingest and stores the BCP-47 tag. Fire-and-forget so SMS ACK isn't held on a Claude RTT.
- [x] **One-click translate** — `/api/messages/[id]/translate` translates an inbound into the tenant's locale via Claude Haiku and caches the result on the row (with `translated_to` to invalidate when the tenant changes locales). Inbox renders a small language chip + "Translate → en-US" link on foreign-language inbounds; clicking swaps the body in place, second click toggles back to original.
- [x] **Migrations** — `0016_phase16_i18n.sql` adds the three columns + a partial index on `(tenant_id, language)` for cheap "messages in X language" filters.

### Notable design calls

- **Claude Haiku over a stats-based detector.** "ok thanks" reads as English to franc/cld3 regardless of the surrounding conversation language. Haiku catches context, costs <$0.0001 per detection, and handles 100+ languages including SMS-grade slang. Worth the ~200ms async cost on a fire-and-forget path.
- **Cache translations on the row, not on a side table.** `translated_body` + `translated_to` on `messages` means a single SELECT loads the thread *and* its translations — no separate fetch round-trip in the inbox loader. Re-translating into a new target locale is just a column update.
- **CLS isn't the only unit-ambiguous metric — make formatters defensive.** `formatNumber` and friends return `"—"` for non-finite values rather than printing "NaN". Cheap guard, removes a class of UI bugs across the dashboard.
- **`primaryLang()` for translation decisions, full BCP-47 for storage.** We *store* "en-US" so a US business sees US-formatted dates, but *compare* on "en" when deciding whether to translate — so an "en-GB" message arriving at an "en-US" tenant doesn't trigger pointless retranslation.

## Phase 17 — embed widgets done

- [x] **`/widget.js`** ([`public/widget.js`](apps/web/public/widget.js)) — single vanilla-JS bundle, ~6 KB, three modes selected by `data-rosie-mode`:
  - `chat` — floating button + lead-capture form; POSTs to `/api/webhooks/leads/<slug>` with `smsConsent` checkbox baked in.
  - `text` — opens `sms:` deep-link with prefilled body to the tenant's SMS number.
  - `review` — star prompt that routes 4–5★ to the configured Google review URL and ≤3★ into a private feedback form (which lands as a lead so the operator can recover the relationship).
- [x] **`/api/embed/config/[tenantSlug]`** ([route](apps/web/src/app/api/embed/config/[tenantSlug]/route.ts)) — public, CORS-open, returns the minimum the widget needs (brand name, primary color, SMS number, review URL, lead endpoint). 60s edge cache + 5-min SWR.
- [x] **CORS on the lead webhook** — `OPTIONS` preflight + `Access-Control-Allow-Origin: *` on every JSON response from `/api/webhooks/leads/[tenantSlug]`. Embeds on any operator domain can now post leads back.
- [x] **`smsNumber` + `reviewUrl` on brandTheme** — new fields on the `tenants.brandTheme` JSONB (no migration needed). BrandingCard adds inputs for both; the `Theme` zod schema in `/api/branding` validates them.
- [x] **EmbedCard in settings** — three-tab snippet generator with copy-to-clipboard, dim/warning when SMS or review URL is missing for the corresponding widget, and a hint about the optional `data-rosie-color` / `data-rosie-label` overrides.

### Notable design calls

- **One bundle, three modes.** Operators paste exactly one `<script>` tag. Mode lives on the tag, not in a separate file, so an A/B test ("switch from text to chat") doesn't require a new copy-paste in their CMS.
- **Resolve origin from the script's own src.** The widget calls back to whatever host served it — no env vars, no rebuilds when we move domains. Operators can paste a snippet pointing at `app.rosie.com` and the lead POST goes there even though their site is on `acme-plumbing.com`.
- **Star prompt routes by sentiment, not by request.** The widget never asks "good or bad?" — it shows stars, lets the visitor tap, and *then* routes. Visitors tapping 4–5★ go straight to Google (operator wins SEO), low-star visitors land in a private feedback form (operator gets a chance to fix it before the review goes public).
- **JSONB over a new column for `smsNumber`/`reviewUrl`.** Storing on `brandTheme` keeps schema migrations cheap and groups all "stuff the operator sets on the brand" together. The Theme zod schema enforces field-level validation per key.

## Phase 18 — marketplace + integrations directory done

- [x] **Single source of truth** ([`lib/integrations/catalog.ts`](apps/web/src/lib/integrations/catalog.ts)) — every integration's metadata (category, status, tagline, description, unlocks, setup steps, connect path, docs URL, tags) lives in one TypeScript registry. The settings cards, the public catalog, and the per-provider detail pages all read from it.
- [x] **Public catalog** ([`/integrations`](apps/web/src/app/integrations/page.tsx)) — marketing page grouped by category (Messaging, Voice, Ads, Search, AI, …) with status badges and category-jump chips. Built `force-static` so it's a single CDN hit.
- [x] **Per-provider detail pages** ([`/integrations/[key]`](apps/web/src/app/integrations/[key]/page.tsx)) — `generateStaticParams()` prerenders one page per integration at build time. Each page shows the long description, what it unlocks, numbered setup steps, an "Open in Rosie" CTA when there's a `connectPath`, and the provider's external docs link.
- [x] **Generic OAuth state helper** ([`lib/oauth/state.ts`](apps/web/src/lib/oauth/state.ts)) — provider-agnostic `issueOAuthState(key, tenantId)` + `verifyOAuthState(key, state)`. Each provider gets its own cookie so concurrent connect flows in two tabs don't clobber each other.
- [x] **Settings ↔ catalog links** — every connected-integration card in `/settings` now has a "Setup guide ↗" link that opens the matching `/integrations/<key>` page in a new tab. Catalog membership is declared with a single `catalogKey` field per local definition.
- [x] **Middleware exemptions** — `/integrations` + `/api/embed/` added to public paths + custom-domain skip prefixes, so the catalog renders identically on the app domain and any tenant-owned domain.

### Notable design calls

- **Catalog ≠ runtime registry.** The catalog is metadata-only; it doesn't drive which integrations *work*, just which we document. New providers ship in two stages: (1) wire the OAuth + secrets handling in code, (2) add a catalog entry. Until step 2, they exist but aren't discoverable.
- **`force-static` for the public catalog.** Marketing pages don't need per-request data, so we prerender all 13 detail pages plus the root catalog. Edge serves them from cache, build time stays under a second for the route.
- **One cookie per OAuth provider.** Previous Google flow used `rosie-google-oauth`; new helper uses `rosie-oauth-<key>`. Means an operator can connect Meta + Google simultaneously in two tabs without one wiping the other's CSRF nonce. Old Google helper kept in place so existing callbacks keep working — new providers should use the generic.
- **Catalog detail pages link out to provider docs.** We don't mirror Quo's or Vapi's documentation — we link to it. Maintaining a copy would rot the moment the provider updates anything; linking out keeps Rosie's docs honest about which knobs are theirs vs ours.

## Phase 19 — reliability + dead-letter queue done

- [x] **`dead_letter_queue` table** ([`dlq.ts`](packages/db/src/schema/dlq.ts)) — one row per background operation that exhausted its in-process retries. `source` + minimal `payload` are all the replay handler needs; `last_error` keeps a 6-line stack snippet for triage; `replay_count` + `last_replay_at` track operator action. Migration [`0017_phase19_dlq.sql`](packages/db/migrations/sql/0017_phase19_dlq.sql).
- [x] **`lib/retry.ts`** — exponential backoff with full jitter, capped per-attempt sleep, and a `transientOnly` predicate that skips retries on 4xx errors (which are usually permanent — bad input, expired token).
- [x] **`lib/dlq.ts`** — `enqueueDlq()` lands a failed op; `runWithDlq()` is the convenience wrapper that retries then enqueues on terminal failure; `replayDlq(id)` dispatches to a per-source replayer; `resolveDlq(id, reason)` closes an entry as resolved or abandoned.
- [x] **CAPI retry + DLQ end-to-end** — Meta / Google Ads / TikTok conversion fires now wrap their `fetch()` in `retry()` with the transient-only predicate. When every retry fails, the failed `PlatformFireResult` triggers `enqueueDlq()` with a source like `capi.meta.lead`. Replayers registered at module load can re-fire the conversion for just that one platform.
- [x] **`/dlq` admin viewer** ([`page.tsx`](apps/web/src/app/(app)/dlq/page.tsx) + [`view.tsx`](apps/web/src/app/(app)/dlq/view.tsx)) — list buried entries filtered by source, expand to see error stack + payload JSON, **Retry** to re-run via the registered replayer, **Abandon** when the source is broken. Sidebar link in Operations, audited via `recordAudit()` on every retry/abandon.

### Notable design calls

- **Retry inside the worker, DLQ across processes.** `retry()` handles 4 attempts of jittered backoff in-line, which catches the 99% of transient failures (5xx, network blips, rate limits). Only what survives that lands in the DLQ — so the table stays small and the rows that are there genuinely need a human.
- **`source` strings, not handler refs.** A DLQ row outlives any specific code path. Storing `"capi.meta.lead"` as a string lets us rename the implementing function freely; the replayer registry is the one place that knows the wiring.
- **Replay is `await`-ed and re-locked.** `replayDlq()` flips status to `retrying` *before* invoking the replayer, so a double-click in the UI doesn't double-fire. On success → `resolved`; on failure → back to `pending` with the new error.
- **No RLS on the DLQ table.** Entries are operator-internal — they're only read by the `/dlq` page (which already requires auth) and only written by service-role server code. Skipping RLS dodges a bunch of policy fiddling for zero practical exposure.
- **Replayers register at module load.** `fire.ts` calls `registerReplayer()` at top-level, and the retry route force-imports `lib/conversions/fire` to guarantee the side effect ran. New sources should follow the same pattern — keeps the wiring colocated with the producer code.

## Phase 20 — public API + webhooks out done

- [x] **API key scopes** — new `api_keys.scopes` JSONB column carrying granular grants like `leads:read`, `data:export`, `webhooks:manage`. `authenticateApiRequest(req, scope?)` enforces scope per call and returns a useful 403 when the key isn&apos;t authorized. Legacy keys (no scopes column populated) keep working via a documented default set.
- [x] **Outbound webhook contract** ([`outbound-webhooks.ts`](packages/db/src/schema/outbound-webhooks.ts)) — `webhook_subscriptions` per tenant (URL, secret, event filter, enabled flag) + `webhook_deliveries` log (one row per attempt with response status + body preview + duration). Both RLS-locked to tenant members.
- [x] **`lib/webhooks-out.ts`** — `emitEvent(tenantId, event, payload)` fans out to enabled subscriptions, signs with `sha256=hex(HMAC(secret, "<ts>.<body>"))`, retries via `retry()` with `transientOnly` on 5xx/network. Every attempt logs to `webhook_deliveries`; terminal failure also lands in the DLQ as `source: "webhook.dispatch"`.
- [x] **Event emitters wired into producers** — `lead.created` fires from the lead intake webhook with the lead's id/name/contact/attribution; `conversation.message_received` fires from inbound messaging webhooks with the message + conversation + provider. Add more by calling `emitEvent()` at the producer site.
- [x] **Subscription mgmt API** — `GET/POST /api/webhook-subscriptions` lists + creates; `PATCH/DELETE /api/webhook-subscriptions/[id]` updates + removes. Creation response surfaces the signing secret exactly once; the UI shows a one-time-reveal banner with copy.
- [x] **`WebhooksOutCard` in settings** — list of subscriptions with event-filter chips, enable/disable toggle, delete, and an inline create form. Suspended subscriptions get a red badge so the operator knows fan-out is paused.
- [x] **`/docs/api` public reference** — static-prerendered page documenting auth, all `/api/v1/*` endpoints with their required scopes, the seven outbound event types, the header contract, Node + Python signature-verification snippets, and delivery semantics. Middleware exempts `/docs/` from auth + custom-domain rewrites.
- [x] **Migration** [`0018_phase20_outbound_webhooks.sql`](packages/db/migrations/sql/0018_phase20_outbound_webhooks.sql) — adds the scopes column, both webhook tables, the two enums (`outbound_event`, `webhook_delivery_status`), and RLS policies.
- [x] **`verifyOutboundSignature()` helper** — constant-time-compare HMAC verifier with a configurable timestamp tolerance. Same module as the dispatcher so producer + verifier can't drift on the wire format.

### Notable design calls

- **Sign `"<ts>.<body>"`, not just `<body>`.** Including a timestamp in the HMAC input means a replayed delivery (intercepted by a MITM) only validates within the tolerance window. Pairs naturally with the `X-Rosie-Timestamp` header verifiers already check.
- **Reveal the secret exactly once.** Stored in plaintext (the dispatcher needs it on every call), but the API only returns it on creation. Operators who lose it must rotate by deleting + recreating the subscription — same UX Stripe / GitHub use.
- **`events: []` means &quot;all events&quot;.** Common enough pattern (audit-log type subscribers) that defaulting empty arrays to wildcard is more useful than forcing every consumer to enumerate the full list.
- **Scope-check in `authenticateApiRequest`, not as a separate middleware.** One function, one source of truth — every route that takes auth automatically gets the rate limit, the scope check, and the last-used bump. Less per-route boilerplate, harder to forget.
- **Outbound dispatcher is fire-and-forget at the call site, blocking internally.** Producers don't `await` `emitEvent()` directly, but inside it we *do* await each delivery so we can write the audit row. Combined with the 10s timeout per attempt + retry budget, the total ceiling on a slow consumer is bounded.

## Phase 21 — onboarding + activation funnel done

- [x] **`lib/activation.ts`** — single function `computeActivation(tenant)` returns the six-step funnel: `business_profile`, `branding`, `messaging`, `ads`, `landing_page`, `first_lead`. Each step is computed from live state (4 parallel queries) so we don't carry a per-step flag column that can drift.
- [x] **`ActivationChecklist`** ([`activation-checklist.tsx`](apps/web/src/components/activation-checklist.tsx)) — checklist card pinned to the top of `/overview` until everything's done. Shows a progress bar, per-step status, and deep links to the screen that completes each step. Auto-hides once the funnel is complete; empty-state tenants get a loud "Try with sample data" button.
- [x] **Sample-data seeder** ([`/api/onboarding/seed-sample`](apps/web/src/app/api/onboarding/seed-sample/route.ts)) — drops in 7 fictional leads spanning every pipeline stage (new → won → lost), with realistic SMS-style first messages and Rosie's outbound replies. Conversations + messages are wired so the inbox renders threads end-to-end. Idempotent (skips phones that already exist) and tagged with `metadata.seeded = true`. Companion `DELETE` clears just the seeded rows.
- [x] **Inbox empty state** — replaces the bare "Connect Quo or OpenPhone" line with an `InboxEmptyState` component: friendly copy, "Add sample conversations" CTA, note that seeded data is easy to clear later.

### Notable design calls

- **No per-step flag column.** Every checklist item derives from existing tables (`business_profile.phone`, `integrations.status`, `landing_pages` count, etc.). Means we never have a state where the funnel says "you're done!" but the data hasn't actually arrived — the funnel *is* a view over reality.
- **JSONB tag for sample data.** Storing `metadata.seeded = true` keeps the cleanup query defensive: even if the seed list grows, DELETE only matches rows that were *actually* seeded. The phone-prefix filter that almost shipped would have been a footgun.
- **Idempotent seed.** Re-clicking "Add sample conversations" is a no-op — the route looks up each phone before inserting. Means the button is safe to surface in multiple places (overview activation card, inbox empty state) without worrying about duplicates.
- **Loud sample-data CTA only on fully empty tenants.** Tenants with one real lead but no integrations don't need the sample button shoved in their face — the checklist already has next steps. Adding pretend data on top of real data confuses the funnel.

## Phase 22 — coaching loops done

- [x] **Experiments schema** ([`experiments.ts`](packages/db/src/schema/experiments.ts)) — `experiments` + `experiment_variants` with per-variant impressions, conversions, and a running `score`. Three surfaces: `cadence`, `landing_headline`, `reply_template`. Per-tenant unique on `slug` so producers look up "their" experiment by stable identifier.
- [x] **Thompson-sampling variant picker** ([`lib/experiments.ts`](apps/web/src/lib/experiments.ts)) — `pickVariant(tenantId, slug, seed?)` samples from each variant's Beta(α=conv+1, β=imp-conv+1) distribution and returns the highest draw. Naturally explores under-tested variants while exploiting strong performers. `markImpression()` + `markConversion()` close the loop; an operator-set `isWinner` overrides sampling.
- [x] **Weekly recap composer** ([`lib/coaching/recap.ts`](apps/web/src/lib/coaching/recap.ts)) — `buildWeeklyRecap()` aggregates new/won/lost leads, inbound + outbound messages, posts published, open actions, and a week-over-week delta for new + won. `renderRecapEmail()` produces email-client-safe HTML inline (no template engine).
- [x] **Weekly recap cron** ([`/api/cron/weekly-recap`](apps/web/src/app/api/cron/weekly-recap/route.ts)) — `Authorization: Bearer $CRON_SECRET`, iterates every tenant, skips ones with zero activity, fans the email out to owners + operators. `?dry=1` query for safe rehearsal.
- [x] **`/review` page** ([`page.tsx`](apps/web/src/app/(app)/review/page.tsx) + [`view.tsx`](apps/web/src/app/(app)/review/view.tsx)) — open actions grouped by source (Auto-Rosie, coaching rules, manual), with priority badges, bulk checkbox selection, and four bulk ops: **Approve all**, **Approve selected**, **Snooze 24h**, **Dismiss**.
- [x] **`/api/actions/bulk`** — batch endpoint (max 200 ids) for the bulk operations, audited as a single tenant.update event so the audit log stays readable.
- [x] **Sidebar link** — "Weekly Review" added to the Pipeline Tools group alongside Action Plan, so operators can context-switch in one click.
- [x] **Migration** [`0019_phase22_coaching.sql`](packages/db/migrations/sql/0019_phase22_coaching.sql) — creates both experiment tables, enums (`experiment_status`, `experiment_surface`), and RLS policies (variant policy reaches up through the experiment row).

### Notable design calls

- **Bandit > A/B split.** Fixed-percentage splits waste impressions on a losing variant after the first signal. Thompson sampling auto-shifts traffic toward the winner without losing the safety net of continued exploration; the math is short enough to ship inline (sampleBeta via two gamma draws).
- **Score as a column, not a derived view.** `score` materializes the running conversion rate so the operator-facing reports can render in a single SELECT. The picker doesn't actually need it (it re-samples from raw α/β every call), but the operator UI benefits from a sortable column.
- **Recap skips quiet tenants.** A 0-leads/0-messages week is noise — emailing "you did nothing!" trains operators to mute Rosie. The cron filters those out and reports the skip count in the response.
- **Inline HTML, no template engine.** Resend doesn't care; rendering a fixed three-block layout in template literals is cheaper to maintain than a full email-html templating stack and keeps the bundle slim.
- **`isWinner` is a free-form text override.** Operator can pin the winning variant by writing its label into the column; the picker checks for any non-null value and serves that variant. Easier than adding an enum or a boolean per row.
- **Bulk endpoint over per-row PATCH loop.** "Approve all" can hit 100+ rows in one click — one transactional UPDATE is dramatically cheaper than 100 round-trips, and lands a single audit-log entry the operator can actually parse later.

## Phase 23 — multi-region + data residency done

- [x] **`tenants.region` + `residency_only`** ([`tenants.ts`](packages/db/src/schema/tenants.ts)) — new enum column (`us`/`eu`/`au`, defaults to `us` for back-compat) plus a text flag for strict residency. Indexed for cheap "all tenants in region X" scans. Migration [`0020_phase23_regions.sql`](packages/db/migrations/sql/0020_phase23_regions.sql).
- [x] **`createDb()` factory** ([`packages/db/src/index.ts`](packages/db/src/index.ts)) — the legacy `db` export is now a Proxy that lazy-resolves to `createDb(DATABASE_URL)`, so importing `@rosie/db` no longer crashes when the env var is unset (eg drizzle-kit, tests). The factory itself is the public surface region routing builds on.
- [x] **`lib/regions.ts`** — region registry, `availableRegions()` (filtered by whether env vars are populated), `dbForRegion()` + `supabaseAdminForRegion()` with per-region memoization, `publicStorageUrl()`, and `residencyAllowsCrossRegion()` for the strict-mode gate.
- [x] **Env-var convention** — `<KEY>_<REGION_UPPER>` with a documented fallback to the unsuffixed legacy var. Means a single-region deploy keeps working unchanged; provisioning a new region is "set 4 env vars, redeploy."
- [x] **Region selector at sign-up** ([`onboarding/form.tsx`](apps/web/src/app/onboarding/form.tsx)) — only renders when the deployment serves more than one region. `createTenant()` validates the requested region against `availableRegions()` server-side and silently falls back to `us` if the operator picked something we can't honor.
- [x] **`RegionCard` in settings** ([`region.tsx`](apps/web/src/app/(app)/settings/region.tsx)) — read-only region display plus a strict-residency toggle. PATCH `/api/tenant/residency` persists; audited.
- [x] **`uploadPublicForRegion()`** ([`supabase/admin.ts`](apps/web/src/lib/supabase/admin.ts)) — region-aware Storage upload that lands binaries in the region's Supabase project. Falls back to the legacy client when a region's vars aren't provisioned, so the migration to per-region storage is opt-in per region.

### Notable design calls

- **Region is set at sign-up, not changeable in-product.** Moving a tenant between regions is a data-migration ticket — Postgres rows + Storage uploads + Realtime subscriptions all have to move atomically. Exposing a "change region" button would lie about the cost. The UI says so explicitly.
- **Fallback to legacy env vars.** `DATABASE_URL` (no suffix) is the universal default. Existing single-region tenants keep working without any env var rename — multi-region is purely additive. Operators provisioning their first non-US region just add `DATABASE_URL_EU` and the rest of the chain.
- **`db` export is now a Proxy.** Lazy resolution dodges the import-time crash that broke drizzle-kit and a few test paths. The first time *any* property is accessed it materializes the connection — same DX as before but defers the env check.
- **`residencyOnly` is `text`, not `boolean`.** Lets us extend later (`"strict"` vs `"stricter"` for different DPA tiers) without another schema change. Empty/NULL = off.
- **Region picker hidden when there's only one option.** Showing a one-item dropdown is friction without choice. The onboarding form keys off `availableRegions()` and just falls back to `us` silently when single-region.
- **No background migration of existing tenants.** Anyone who signed up before this phase shipped is `us` by default. EU/AU customers who want to *move* file a migration request; new EU/AU signups choose at sign-up. No surprise data movements.

## What's next (Phase 24+)

- **Phase 24 — Cost dashboard + per-tenant unit economics**: tokens consumed, AI cost per lead, SMS spend per won deal, dashboards that show which tenants are profitable vs unprofitable.

## Testing Phase 1 end-to-end (no real provider yet)

You can simulate an inbound SMS to see the full pipeline working before connecting Quo/OpenPhone:

```bash
# 1. Find your tenant slug in Settings (something like "scoop-doggy-logs-a1b2")

# 2. Simulate an OpenPhone inbound webhook:
curl -X POST "http://localhost:3000/api/webhooks/messaging/openphone/<your-slug>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message.received",
    "data": { "object": {
      "id": "msg_test_001",
      "conversationId": "conv_test_001",
      "from": "+18005550100",
      "to": ["+15205551234"],
      "body": "can I get a quote?",
      "createdAt": "2026-05-18T08:33:00Z"
    }}
  }'

# 3. Open /inbox — the lead appears in "New", thread loads, hit "Suggest" to see
#    Rosie draft a reply, then "Send" (will dry-run since the provider's not connected).
```

## Tech stack reference

See [`PLAN.md §3`](./PLAN.md#3-tech-stack-confirmed). Locked-in choices: Vercel + Supabase + Drizzle + Inngest + Claude (Anthropic) + Quo/OpenPhone + Vapi + Tinybird + Stripe.
