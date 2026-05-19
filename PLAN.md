# Project Plan — Rosie

> "Talk to Rosie." An always-on AI operator for local service businesses.

## What we're building

**Rosie** is our take on GroMore Media's W.A.R.R.E.N. (*Weighted Analysis for Revenue, Reach, Engagement and Navigation*) — an "always-on AI operator" that consolidates marketing, lead pipeline, reporting, and next-action recommendations for local service businesses (the reference tenant in the WARREN screenshots is **Scoop Doggy Logs**, a pet-waste-removal company).

Where WARREN is a buttoned-up analyst, **Rosie is a teammate** — same depth of operational coverage, friendlier surface, more aggressive automation, and a real voice channel.

This document is a complete build spec: feature inventory pulled from the screenshots, gaps to close vs. WARREN, the stack we'll use, and a phased delivery roadmap.

### Naming + domain (placeholders — confirm later)
- Product name: **Rosie**
- Working domain candidates: `getrosie.com`, `hellorosie.com`, `rosie.run`, `withrosie.com`, `rosie.ops`
- Code/package namespace: `@rosie/*`
- AI persona name in the UI: **Rosie** (replaces "W.A.R.R.E.N." everywhere in copy)

---

## 1. Reverse-engineered feature inventory

Grouped exactly how WARREN groups them in its sidebar.

### Core / "Always On"
| Feature | What it does | Notes from screenshots |
|---|---|---|
| **Talk to Rosie** | Persistent AI chat sidebar, available everywhere | Model picker, date scoper, context-aware ("Your Google Ads spend burned $285 this month with zero leads...") |
| **Auto-Rosie** | Agent that runs marketing actions on a schedule with minimal human input | Top of nav — the headline feature |
| **Overview** | Gauge dashboard: Paid Ads / Organic / Website / KPIs each get a score 0–100 + letter grade A–F | "Ahead of pace" / "Watch" / "Healthy" badges, "Simple Paths" cards routing to Create / Manage / Analyze / Outreach |
| **Action Plan** | Prioritized list of next moves WARREN recommends | "Fix Next:" cards on the gauge cluster feed this |
| **Missions** | Operator-style daily tasks the user works through | Sidebar item under Inbox |
| **Coaching** | Coaching content / 1:1 prompts | Sidebar item — likely on-demand strategy guidance |

### Pipeline Tools (CRM)
| Feature | What it does |
|---|---|
| **Leads / CRM** | Residential pipeline with stages: New → Engaged → Quoted → Qualified → Booked → Won / Lost |
| **Lead Follow-Up** | Automated nudge cadences |
| **Commercial Leads** | Separate B2B pipeline |
| **Conversations / Inbox** | Unified SMS thread view (via Quo or OpenPhone), with Rosie replying in-line on the user's behalf |
| **Lead Assistant** | AI lead-qualifier / first-touch responder |
| **Bulk Messages** | Mass SMS to filtered cohorts |

### Marketing (Create)
| Feature | What it does |
|---|---|
| **Campaigns** | Cross-platform campaign roll-up |
| **Ad Builder** | Compose paid ads (Google / Meta) |
| **Creative** | Library of approved creative assets |
| **Image Creator** | Prompt-driven ad-image generator (OpenAI `gpt-image-2`, formats: square/wide/story, exact-ad-text fields, brand-tone selector) |
| **QR Studio** | Branded QR codes; every scan routes through a WARREN short-URL (`gromore-admin.onrender.com/q/<code>`) so scans are attributed |
| **Print Studio** | Cards, signs, leave-behinds, vehicle wraps |
| **Blog** | AI-drafted SEO posts |
| **Post Scheduler** | Facebook organic publisher; brand-storytelling profile (tone, selling style, post length), storytelling guardrails (what NOT to say), recurring characters (mascots / brand personas as JSON), 2-or-4-week bulk calendar generation, CSV upload |
| **Quick Launch** | Templated one-click campaigns |
| **Site Builder** | Landing-page / mini-site builder |

### Operations / Business
| Feature | What it does |
|---|---|
| **My Business** | NAP, hours, services, service area |
| **Google Profile** | GBP completeness score (%), reviews surface, photos count, missing-field tips, deep-link to `business.google.com` |
| **Competitor Intel** | Surface competitor activity & gaps |
| **KPIs** | Targets + pacing, letter grade |
| **Specialists** | Vendor / contractor directory |
| **People / Your Team** | Team management |
| **Work Queue** | Internal task queue |
| **Hiring Hub** | Recruiting + job posts |
| **Settings / Connections** | Integration drawer: Make.com (incoming + outgoing webhooks with bearer secret), Google Calendar OAuth, OpenPhone (SMS), webhooks |
| **Automations** | No-code workflow builder |
| **Titan** | Unclear from screenshots — likely premium tier / power-user surface |
| **Feedback / Help** | Support |

### Cross-cutting / Platform
- **Multi-tenant** ("Viewing as Mark Gromer" admin impersonation banner)
- **Tracking-URL service** — short-link redirector that logs every click
- **Performance gauges & grading** — Paid 76 / Organic 55 / Website 67 → composite "B"
- **Brand voice profile** — central JSON the AI loads into every drafting tool

---

## 2. Where we should beat WARREN

These are upgrades, not parity. None of them appear in the screenshots, and most are cheap to add if we design for them on day one.

1. **Multi-model AI router.** WARREN seems locked to OpenAI. Route by job: **Claude (Opus/Sonnet)** for strategy/Talk-to-WARREN and copywriting, **GPT-image / gpt-image-2** for ad images, **Higgsfield** for video + the virality predictor that's already in your MCP toolbelt, **Gemini** for cheap bulk drafts. Single `ai-router` package, prompt-cached.
2. **Server-side conversion tracking out of the box.** GA4 + Meta CAPI + TikTok Events API + Google Enhanced Conversions wired to the lead pipeline so every Won lead pushes a conversion back to the ad platforms with the same event ID it came in on. This is the single biggest ROAS lever and WARREN's screenshots don't show it.
3. **Voice channel.** Add **Vapi** or **Retell AI** for AI-answered missed calls + outbound qualification calls. Local service businesses lose more leads to unanswered phones than anything else.
4. **Predictive lead scoring.** Train a small model on `(lead features) → (won/lost)` per tenant once they have ~100 leads; surface "this lead is 78% likely to close" inside the inbox. WARREN only shows pipeline stage.
5. **Native A/B testing engine.** Headline / image / landing-page splits with auto-promote at significance. Local SMBs never run real tests; this becomes a moat.
6. **Programmatic SEO engine.** Generate `service × city` pages at scale from the My Business config (e.g. `pet-waste-removal-{tucson,oro-valley,marana}`), regenerate on schedule, ping Google. Way beyond the per-post Blog tool.
7. **Review-request cadence.** Automated SMS+email ask after Won, with magic-link to Google review + fallback to private feedback. The Google Profile screen shows reviews but no engine to grow them.
8. **Attribution dashboard with channel-level CAC.** Don't just show "Click Rate 5.9%" — show CAC, LTV, payback period per channel. Pull from the same pipeline data that already exists.
9. **White-label / reseller mode.** Let an agency operator run WARREN under their own brand for their clients. Big TAM unlock; WARREN is single-brand today.
10. **Mobile-first PWA + push.** The operator persona ("Mark Gromer") is in the field. Native install, push notifications for new leads & missed calls, voice-to-text reply.
11. **Real-time collaboration.** Two team members in the same inbox thread, presence indicators, typing indicators. WebSockets / Pusher / Ably.
12. **Built-in dbt-style metrics layer.** Define `cost_per_lead`, `close_rate`, `revenue_per_visit` once; every gauge, chart, and AI prompt reads from the same definitions. Prevents the "your dashboard says X, your AI says Y" drift that plagues these platforms.
13. **Audit log + undo for AI actions.** Every Auto-Rosie action is logged with the prompt, the diff, and a one-click revert. Trust is everything when you let an agent post to Facebook on your behalf.
14. **Open API + Zapier/Make app.** WARREN already integrates with Make as a consumer; we should publish *as a service* so users can route any external system into WARREN's CRM.
15. **Cost & spend governor.** Per-tenant LLM/image/SMS budget caps with alerting. Otherwise AI costs eat the margin.

---

## 3. Tech stack (confirmed)

Aligned with the Next.js patterns already in `~/Library/CloudStorage/.../Developer/Web/*`:

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Matches your other projects; server actions cover most of the API surface |
| UI | **Tailwind v4 + shadcn/ui + Radix** | Fast, accessible, copy-paste components |
| **DB + Auth + Storage + Realtime** | **Supabase** (Postgres + Auth + Storage + Realtime + pgvector) | One service handles DB, auth (incl. orgs/tenants via RLS), file storage for generated images & QR PNGs, websockets for inbox presence, and pgvector for brand-voice RAG |
| ORM / migrations | **Drizzle ORM** on top of Supabase Postgres | Type-safe schema + first-class RLS support |
| Background jobs | **Inngest** | Cron + retries + step functions; perfect for Auto-Rosie agents |
| AI gateway | Custom `@rosie/ai` package wrapping Anthropic + OpenAI + Higgsfield MCP | Prompt caching, fallback, cost ledger, per-tenant budget governor |
| SMS / messaging | **Quo** (primary) with **OpenPhone** adapter for parity | Both supported behind one `@rosie/messaging` interface; Quo's API for new tenants, OpenPhone for any tenants migrating from WARREN |
| AI voice | **Vapi** | Inbound missed-call answering + outbound qualification calls |
| Email | **Resend** + **react-email** | DX, deliverability |
| Analytics | **PostHog** (product) + **Tinybird** (gauge math) | Tinybird gives sub-second roll-ups for the four gauges |
| Tracking URLs | First-party route `/q/[code]` writing to Tinybird | Owned attribution, no third-party shortener |
| **Hosting** | **Vercel** (web) + **Supabase Cloud** + **Inngest Cloud** | All managed, no Render |
| Observability | **Sentry** + **Axiom** logs | |
| Payments | **Stripe** (Billing + Usage-based pricing) | For per-seat + LLM/SMS overages |

**Monorepo layout** (Turborepo + pnpm):

```
apps/
  web/                Next.js — the Rosie UI (signed-in app)
  marketing/          Public site + signup at getrosie.com
packages/
  db/                 Drizzle schema, migrations, RLS policies
  ai/                 Multi-model router (Claude / OpenAI / Higgsfield), prompt cache, cost ledger
  jobs/               Inngest functions (Auto-Rosie, gauge recompute, review cadence, etc.)
  messaging/          Quo + OpenPhone adapters behind one interface
  integrations/       Google (GBP/Ads/Calendar), Meta (Ads/CAPI/Graph), TikTok, Make.com, Vapi, Stripe
  ui/                 Shared shadcn components + Rosie design system
  tracking/           Short-URL redirector + event ingest to Tinybird
  agents/             Auto-Rosie tool definitions + audit log + undo
```

---

## 4. Data model (skeleton)

Top-level tables — every business table is keyed by `tenant_id`:

- `tenants`, `users`, `memberships` (role: owner / operator / staff / client)
- `business_profile` (NAP, hours, services, service area, brand voice JSON, recurring characters JSON)
- `leads` (stage, source, channel, score, owner, lifecycle timestamps)
- `conversations`, `messages` (channel: sms / email / call / fb-dm)
- `campaigns` (platform, objective, status, budget, dates) → `ad_sets` → `ads` → `creatives`
- `creatives` (image / video / copy variant; provider, prompt, brand-voice snapshot, S3 key)
- `posts` (organic; platform, scheduled_at, status, draft, final, character refs)
- `qr_codes` (code, destination_url, frame_text, color, scan_count)
- `tracking_clicks` (qr scans + short-link clicks; ClickHouse for volume)
- `kpis` (definition + target + period) → `kpi_values` (computed)
- `gauges` (paid / organic / website / kpis — computed nightly + on-demand)
- `actions` (Action Plan items; status, assignee, due, source: "warren" / "user")
- `auto_rosie_runs` (agent invocation log with prompt, tools used, diff, undo token)
- `integrations` (per-tenant OAuth / API key vault, encrypted at rest)
- `metric_definitions` (the dbt-style layer)
- `audit_log` (everything)

---

## 5. Phased delivery roadmap

I'd ship this in 6 phases over ~16 weeks solo, faster with help. Each phase ends with something the user can actually run.

### Phase 0 — Foundations (Week 1)
- Turborepo + pnpm + Next.js 15 app
- Supabase project (DB, auth, storage, RLS-based multi-tenant)
- Drizzle schema for `tenants`, `users`, `memberships`, `business_profile`
- Base shell UI: sidebar (matches WARREN's grouping), top bar, dark mode toggle, "Viewing as" impersonation banner
- **Talk-to-Rosie** sidebar component — Claude streaming, prompt caching, no tools yet
- Settings page skeleton + integration drawer
- **Demo:** sign up, create a tenant, chat with Rosie about a fake business

### Phase 1 — Lead capture + Inbox (Weeks 2–3)
- `leads` + `conversations` + `messages` schema
- `@rosie/messaging` adapter with **Quo** (primary) and **OpenPhone** (alt) drivers behind one interface
- Inbound SMS webhooks → conversations, with Supabase Realtime fan-out to the inbox UI
- Inbox UI with pipeline stages, drag-to-advance, AI suggested replies (Claude tool: `suggest_reply`)
- Lead intake webhook (`/webhooks/leads/<tenant>`) for Facebook lead forms + Make.com
- **Demo:** SMS hits Quo → appears live in inbox → operator (or Rosie) replies → stage advances

### Phase 2 — Marketing creative tools (Weeks 4–6)
- Brand voice profile (storytelling strategy, guardrails, recurring characters, content personality, selling style, post length)
- Image Creator with `gpt-image-2` + format presets + exact-ad-text overlay fields
- QR Studio with first-party short-link service + scan analytics
- Post Scheduler: compose, AI draft from brand profile, calendar generation, scheduled publish to Meta Graph
- **Demo:** generate a branded ad image, a QR for a print piece, and a month of FB posts in <5 min

### Phase 3 — Overview, Gauges, Action Plan, Auto-Rosie v1 (Weeks 7–9)
- Tinybird/ClickHouse pipes for the four gauges (Paid / Organic / Website / KPIs)
- Composite letter-grade calc + "ahead of pace" pacing math
- Action Plan generator: nightly Inngest job that diffs gauges → produces ranked actions → Claude writes the explanations
- Auto-Rosie v1: rules-only (no agent yet) — pause-campaign-with-zero-conv, request-review-after-won, send-followup-after-quoted+24h
- **Demo:** dashboard mirrors the screenshot; agent emails a daily action plan

### Phase 4 — Google Profile, Competitor Intel, KPIs, Print/Site Builder (Weeks 10–12)
- GBP OAuth → completeness score + review pull + post-to-GBP
- Competitor Intel: scrape Meta Ad Library + Google ads + GBP photos for N competitors weekly
- KPIs editor + pacing math
- Print Studio (canvas-based templated assets)
- Site Builder (templated landing pages with first-party tracking & message-match injection from the campaign)
- **Demo:** "completeness 88%", competitor activity feed, generate a campaign-matched landing page

### Phase 5 — Auto-Rosie v2 (agentic), Voice, Server-side conversions (Weeks 13–15)
- Auto-Rosie v2: Claude tool-use loop with explicit tools (`pause_campaign`, `draft_post`, `request_review`, `qualify_lead`), audit log, undo
- Vapi integration for missed-call AI + outbound qualification
- Server-side conversion API: lead won → Meta CAPI + Google Enhanced Conversions + TikTok Events API with original event_id
- Predictive lead score (logistic regression on tenant's own data, surfaced in inbox)
- **Demo:** ad spend → click → form → SMS → AI voice qualifies → human closes → conversion fires back to ad platform → next week's budget allocation reflects it

### Phase 6 — Polish, white-label, billing (Week 16)
- Stripe billing with per-seat + usage (SMS / LLM / image) overages
- White-label config (logo, colors, domain, "powered by" toggle)
- Mobile PWA + push notifications
- Public API + Zapier app
- Spend governor (per-tenant LLM/SMS budget caps)

---

## 6. Confirmed decisions

| Decision | Locked in |
|---|---|
| **Working directory** | `/Users/brandonecarr/Documents/Web Development/DGS Marketing` |
| **Brand name** | **Rosie** (AI persona name in UI is also "Rosie") |
| **Audience** | Multi-tenant SaaS for local service SMBs |
| **Primary AI** | Claude Opus 4.7 (strategy, copy, agent) + OpenAI `gpt-image-2` (images) + Higgsfield (video + virality predictor) |
| **DB / Auth / Storage / Realtime** | **Supabase** |
| **ORM** | Drizzle |
| **Hosting** | **Vercel** (web) + **Supabase Cloud** + **Inngest Cloud** (jobs) |
| **SMS** | **Quo** primary + **OpenPhone** adapter behind one interface |
| **AI voice** | Vapi |
| **Email** | Resend |
| **Analytics / gauges** | PostHog + Tinybird |
| **Payments** | Stripe |

Domain to be chosen later — picking it doesn't block code.

---

## 7. Immediate next steps

1. Scaffold Phase 0 in this directory: Turborepo + pnpm, Next.js 15 app, Supabase project init, Drizzle schema for tenants, shell UI matching WARREN's sidebar groupings, Talk-to-Rosie streaming chat (Claude). ~1 day of work; at the end you can sign up, create a tenant, and chat with Rosie.
2. Once Phase 0 is running locally, you create the Supabase + Vercel + Quo accounts and drop the keys in `.env.local`. Then we move to Phase 1 (lead capture + inbox).

Awaiting green light to scaffold Phase 0.
