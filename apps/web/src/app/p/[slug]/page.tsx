import { createHash, randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db, landingPages, pageViews, tenants, sql } from "@rosie/db";
import { eq } from "@rosie/db";
import "./public.css";
import { loadTenantPixels, pixelScriptHtml } from "@/lib/ads/pixels";
import { pushPageView } from "@/lib/tinybird";
import { TCPA_DISCLOSURE } from "@/lib/compliance/sms";
import { CookieBanner } from "./cookie-banner";

/** ISO-3166-1 alpha-2 codes for EU + EEA + UK + Switzerland — anywhere ePrivacy / GDPR consent rules apply. */
const EU_COUNTRIES = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO","GB","CH",
]);

export const dynamic = "force-dynamic";

interface Content {
  headline?: string;
  subhead?: string;
  bullets?: string[];
  ctaPrimary?: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  promoCode?: string;
  reviewUrl?: string;
  formFields?: Array<{ name: string; label: string; type: "text" | "tel" | "email" | "textarea"; required?: boolean }>;
}

interface Theme {
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
}

function fingerprint(ip: string | null, ua: string | null) {
  return createHash("sha256")
    .update(`${ip ?? ""}::${ua ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

export default async function PublicLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  // Resolve __root__ (set by middleware on custom domains) to the tenant's
  // configured root landing page via the request Host header.
  let effectiveSlug = slug;
  if (slug === "__root__") {
    const hostHeaders = await headers();
    const host = (hostHeaders.get("host") ?? "").split(":")[0]!.toLowerCase();
    if (!host) notFound();
    const [match] = await db
      .select({ rootSlug: tenants.customDomainRootSlug })
      .from(tenants)
      .where(eq(tenants.customDomain, host))
      .limit(1);
    if (!match?.rootSlug) notFound();
    effectiveSlug = match.rootSlug;
  }

  const [row] = await db
    .select({
      page: landingPages,
      tenantSlug: tenants.slug,
    })
    .from(landingPages)
    .innerJoin(tenants, eq(tenants.id, landingPages.tenantId))
    .where(eq(landingPages.slug, effectiveSlug))
    .limit(1);
  if (!row || row.page.status !== "published") notFound();
  const page = row.page;
  const tenantSlug = row.tenantSlug;

  // Generate the shared eventId for client-side Pixel + server-side CAPI dedup.
  // Persisted into the lead via the form action's URL params.
  const eventId = randomUUID();
  const pixels = await loadTenantPixels(page.tenantId);
  const pixelHtml = pixelScriptHtml({ pixels, eventId, fireLeadOnLoad: false });

  const content = (page.content ?? {}) as Content;
  const theme = (page.theme ?? {}) as Theme;
  const brandName = (page.theme as { displayName?: string } | undefined)?.displayName ?? row.tenantSlug;
  const primary = theme.primaryColor ?? "#5b21b6";
  const accent = theme.accentColor ?? "#f59e0b";
  const background = theme.backgroundColor ?? "#ffffff";

  // Best-effort view logging.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const ua = h.get("user-agent");
  const referer = h.get("referer");
  const country = (h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? "").toUpperCase();
  const showCookieBanner = country !== "" && EU_COUNTRIES.has(country);
  const fp = fingerprint(ip, ua);
  const utmSource = typeof sp.utm_source === "string" ? sp.utm_source : undefined;
  const utmMedium = typeof sp.utm_medium === "string" ? sp.utm_medium : undefined;
  const utmCampaign = typeof sp.utm_campaign === "string" ? sp.utm_campaign : undefined;
  const qrCode = typeof sp.q === "string" ? sp.q : undefined;
  Promise.all([
    db.insert(pageViews).values({
      tenantId: page.tenantId,
      landingPageId: page.id,
      fingerprint: fp,
      referer: referer ?? undefined,
      userAgent: ua ?? undefined,
      utmSource,
      utmMedium,
      utmCampaign,
      qrCode,
    }),
    db
      .update(landingPages)
      .set({ viewCount: sql`${landingPages.viewCount} + 1` })
      .where(eq(landingPages.id, page.id)),
    pushPageView({
      tenant_id: page.tenantId,
      landing_page_id: page.id,
      fingerprint: fp,
      utm_source: utmSource ?? null,
      utm_medium: utmMedium ?? null,
      utm_campaign: utmCampaign ?? null,
      qr_code: qrCode ?? null,
    }),
  ]).catch((e) => console.error("page view log failed", e));

  return (
    <div className="rosie-public" style={{ background, "--primary": primary, "--accent": accent } as React.CSSProperties}>
      {pixelHtml ? <div dangerouslySetInnerHTML={{ __html: pixelHtml }} /> : null}
      <main className="rosie-public__main">
        <header className="rosie-public__hero">
          <h1>{content.headline ?? page.title}</h1>
          {content.subhead ? <p className="rosie-public__subhead">{content.subhead}</p> : null}

          {content.bullets?.length ? (
            <ul className="rosie-public__bullets">
              {content.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : null}

          {content.promoCode ? (
            <div className="rosie-public__promo">
              <span className="rosie-public__promo-label">Promo code</span>
              <code>{content.promoCode}</code>
            </div>
          ) : null}

          <div className="rosie-public__ctas">
            {content.ctaPrimary?.label ? (
              <a className="rosie-public__cta-primary" href={content.ctaPrimary.href || "#"}>
                {content.ctaPrimary.label}
              </a>
            ) : null}
            {content.ctaSecondary?.label ? (
              <a className="rosie-public__cta-secondary" href={content.ctaSecondary.href || "#"}>
                {content.ctaSecondary.label}
              </a>
            ) : null}
          </div>

          {content.reviewUrl ? (
            <p className="rosie-public__review-link">
              <a href={content.reviewUrl}>Leave a Google review →</a>
            </p>
          ) : null}
        </header>

        {content.formFields?.length ? (
          <section className="rosie-public__form-wrap">
            <h2>Tell us about your job</h2>
            <form
              method="POST"
              action={
                page.leadWebhookUrl ??
                `/api/webhooks/leads/${tenantSlug}?` +
                  new URLSearchParams(
                    Object.entries({
                      utm_source: typeof sp.utm_source === "string" ? sp.utm_source : undefined,
                      utm_medium: typeof sp.utm_medium === "string" ? sp.utm_medium : undefined,
                      utm_campaign:
                        typeof sp.utm_campaign === "string" ? sp.utm_campaign : undefined,
                      gclid: typeof sp.gclid === "string" ? sp.gclid : undefined,
                      gbraid: typeof sp.gbraid === "string" ? sp.gbraid : undefined,
                      wbraid: typeof sp.wbraid === "string" ? sp.wbraid : undefined,
                      ttclid: typeof sp.ttclid === "string" ? sp.ttclid : undefined,
                      q: typeof sp.q === "string" ? sp.q : undefined,
                      eventId,
                      landingPageId: page.id,
                    }).filter(([, v]) => Boolean(v)) as [string, string][],
                  ).toString()
              }
              id="rosie-lead-form"
              className="rosie-public__form"
            >
              <input type="hidden" name="landingPageId" value={page.id} />
              {content.formFields.map((f) => (
                <label key={f.name} className="rosie-public__field">
                  <span>{f.label}</span>
                  {f.type === "textarea" ? (
                    <textarea name={f.name} required={f.required} rows={4} />
                  ) : (
                    <input name={f.name} type={f.type} required={f.required} />
                  )}
                </label>
              ))}
              {content.formFields.some((f) => f.type === "tel") ? (
                <label className="rosie-public__consent">
                  <input
                    type="checkbox"
                    name="smsConsent"
                    value="1"
                    required
                  />
                  <span className="rosie-public__consent-text">
                    {TCPA_DISCLOSURE(brandName)}
                  </span>
                </label>
              ) : null}
              <button type="submit">Send</button>
            </form>
            <script
              dangerouslySetInnerHTML={{
                __html: `(function(){var f=document.getElementById('rosie-lead-form');if(f)f.addEventListener('submit',function(){try{window.__rosieFireLeadAll&&window.__rosieFireLeadAll();}catch(e){}});})();`,
              }}
            />
          </section>
        ) : null}

        <footer className="rosie-public__footer">
          <small>
            Powered by Rosie · <a href="/legal/privacy">Privacy</a>
            <a href="/legal/terms">Terms</a>
            <a href="/dsar">Data request</a>
          </small>
        </footer>
      </main>
      <CookieBanner show={showCookieBanner} />
    </div>
  );
}
