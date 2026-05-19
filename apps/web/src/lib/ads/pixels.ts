import { db, integrations } from "@rosie/db";
import { eq } from "@rosie/db";
import { decryptJson } from "@/lib/crypto";

export interface PixelConfig {
  metaPixelId?: string;
  googleAdsConversionId?: string;
  googleAdsConversionLabel?: string;
  tiktokPixelId?: string;
}

/**
 * Loads the public Pixel ids configured on the tenant's ad integrations.
 * Returns only public, non-sensitive values — safe to inline in HTML/JS on a
 * public landing page.
 */
export async function loadTenantPixels(tenantId: string): Promise<PixelConfig> {
  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.tenantId, tenantId));

  const out: PixelConfig = {};
  for (const r of rows) {
    if (r.provider === "meta") {
      const meta = decryptJson<{ pixelId?: string }>(r.secrets);
      if (meta?.pixelId) out.metaPixelId = meta.pixelId;
    } else if (r.provider === "google_ads") {
      const g = decryptJson<{ conversionId?: string; conversionLabel?: string }>(r.secrets);
      if (g?.conversionId) out.googleAdsConversionId = g.conversionId;
      if (g?.conversionLabel) out.googleAdsConversionLabel = g.conversionLabel;
    } else if (r.provider === "tiktok") {
      const t = decryptJson<{ pixelId?: string }>(r.secrets);
      if (t?.pixelId) out.tiktokPixelId = t.pixelId;
    }
  }
  return out;
}

/**
 * Returns the inline <script> tags that fire client-side Pixel/tag events
 * on the public landing page. The shared `eventId` matches the server-side
 * Conversions API send so the platforms can dedupe.
 */
export function pixelScriptHtml(opts: {
  pixels: PixelConfig;
  eventId: string;
  /** Whether to also fire the `Lead` event on initial pageload (use for review_request templates). */
  fireLeadOnLoad?: boolean;
}): string {
  const blocks: string[] = [];
  const evt = JSON.stringify(opts.eventId);
  const leadCall = opts.fireLeadOnLoad ? `fbq('track','Lead',{},{eventID:${evt}});` : "";

  if (opts.pixels.metaPixelId) {
    const id = JSON.stringify(opts.pixels.metaPixelId);
    blocks.push(`
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${id});
fbq('track', 'PageView', {}, { eventID: ${evt} });
${leadCall}
window.__rosieFireLead = function(){ try { fbq('track','Lead',{},{eventID:${evt}}); } catch(e){} };
</script>`);
  }

  if (opts.pixels.googleAdsConversionId) {
    const cid = JSON.stringify(opts.pixels.googleAdsConversionId);
    const label = opts.pixels.googleAdsConversionLabel
      ? JSON.stringify(opts.pixels.googleAdsConversionLabel)
      : null;
    blocks.push(`
<script async src="https://www.googletagmanager.com/gtag/js?id=${opts.pixels.googleAdsConversionId}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${cid});
window.__rosieFireLead_g = function(){ ${
        label
          ? `gtag('event','conversion',{send_to: ${cid} + '/' + ${label}, transaction_id: ${evt}});`
          : ""
      } };
${opts.fireLeadOnLoad && label ? `gtag('event','conversion',{send_to: ${cid} + '/' + ${label}, transaction_id: ${evt}});` : ""}
</script>`);
  }

  if (opts.pixels.tiktokPixelId) {
    const tid = JSON.stringify(opts.pixels.tiktokPixelId);
    blocks.push(`
<script>
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load(${tid});
ttq.page();
window.__rosieFireLead_t = function(){ try { ttq.track('SubmitForm', { event_id: ${evt} }); } catch(e){} };
${opts.fireLeadOnLoad ? `ttq.track('SubmitForm', { event_id: ${evt} });` : ""}
}(window, document, 'ttq');
</script>`);
  }

  // Unified helper the lead form invokes onsubmit; fires Lead on all 3 platforms.
  blocks.push(`
<script>
window.__rosieFireLeadAll = function(){
  try { window.__rosieFireLead && window.__rosieFireLead(); } catch(e){}
  try { window.__rosieFireLead_g && window.__rosieFireLead_g(); } catch(e){}
  try { window.__rosieFireLead_t && window.__rosieFireLead_t(); } catch(e){}
};
</script>`);

  return blocks.join("\n");
}
