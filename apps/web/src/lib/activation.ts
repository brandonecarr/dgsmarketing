import { db, integrations, leads, landingPages, businessProfile } from "@rosie/db";
import { eq, sql } from "@rosie/db";

/**
 * Activation funnel — the ordered list of steps a fresh tenant should complete
 * to get the most out of Rosie. Operators see a checklist on /overview until
 * everything is done. Each step is independently computable from current
 * tenant state (no per-step flag column to drift).
 */
export type ActivationStepId =
  | "business_profile"
  | "branding"
  | "messaging"
  | "ads"
  | "landing_page"
  | "first_lead";

export interface ActivationStep {
  id: ActivationStepId;
  title: string;
  description: string;
  /** Where to go to complete this step. */
  href: string;
  done: boolean;
}

interface TenantSnapshot {
  id: string;
  name: string;
  brandTheme: Record<string, unknown> | null;
}

/**
 * Compute the funnel for a tenant in a single pass. Issues 4 parallel queries
 * — cheap on a fully indexed DB and still cheap enough to render on every
 * /overview page load without caching.
 */
export async function computeActivation(
  tenant: TenantSnapshot,
): Promise<{ steps: ActivationStep[]; done: number; total: number; complete: boolean }> {
  const [profile, providerCounts, paidConnected, anyLanding, anyLead] = await Promise.all([
    db
      .select({
        legalName: businessProfile.legalName,
        phone: businessProfile.phone,
        category: businessProfile.category,
      })
      .from(businessProfile)
      .where(eq(businessProfile.tenantId, tenant.id))
      .limit(1),
    db
      .select({ provider: integrations.provider, status: integrations.status })
      .from(integrations)
      .where(eq(integrations.tenantId, tenant.id)),
    Promise.resolve(null),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(landingPages)
      .where(eq(landingPages.tenantId, tenant.id)),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.tenantId, tenant.id)),
  ]);
  void paidConnected;

  const theme = (tenant.brandTheme ?? {}) as {
    primaryColor?: string;
    displayName?: string;
    logoUrl?: string;
  };
  const themeCustomized = Boolean(
    theme.primaryColor || theme.displayName || theme.logoUrl,
  );

  const messagingConnected = providerCounts.some(
    (r) => (r.provider === "quo" || r.provider === "openphone") && r.status === "connected",
  );
  const adsConnected = providerCounts.some(
    (r) => (r.provider === "meta" || r.provider === "google_ads" || r.provider === "tiktok") && r.status === "connected",
  );

  const profileFilled = Boolean(profile[0]?.phone && profile[0]?.category);
  const landingExists = (anyLanding[0]?.c ?? 0) > 0;
  const leadExists = (anyLead[0]?.c ?? 0) > 0;

  const steps: ActivationStep[] = [
    {
      id: "business_profile",
      title: "Fill in your business profile",
      description: "Name, phone, category, hours — what every drafting tool reads from.",
      href: "/business",
      done: profileFilled,
    },
    {
      id: "branding",
      title: "Set your brand",
      description: "Primary color, logo, display name — applies to public pages + the dashboard.",
      href: "/settings#branding",
      done: themeCustomized,
    },
    {
      id: "messaging",
      title: "Connect an SMS line",
      description: "Quo or OpenPhone. Inbound texts will land in the Rosie inbox.",
      href: "/integrations/quo",
      done: messagingConnected,
    },
    {
      id: "ads",
      title: "Connect an ad platform",
      description: "Meta / Google / TikTok — Rosie can read spend + push conversions.",
      href: "/settings#ad-platforms",
      done: adsConnected,
    },
    {
      id: "landing_page",
      title: "Publish a landing page",
      description: "Drop in a service hero or promo page — Rosie tracks views + leads.",
      href: "/site",
      done: landingExists,
    },
    {
      id: "first_lead",
      title: "Capture your first lead",
      description: "From a form, a webhook, the embed widget, or imported manually.",
      href: "/inbox",
      done: leadExists,
    },
  ];

  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, complete: done === steps.length };
}
