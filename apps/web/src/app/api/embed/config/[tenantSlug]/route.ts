import { NextResponse } from "next/server";
import { db, tenants, businessProfile } from "@rosie/db";
import { eq } from "@rosie/db";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
  // Operators paste this once; it can change mid-day if they re-brand.
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
} as const;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Public widget config. Returns the *minimum* info the embed needs to render
 * correctly: brand name, primary color, the click-to-text phone number, and
 * the review URL (when set). Never returns anything sensitive.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params;
  const [row] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      brandTheme: tenants.brandTheme,
    })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "unknown tenant" }, { status: 404, headers: CORS_HEADERS });
  }

  const theme = (row.brandTheme ?? {}) as {
    displayName?: string;
    primaryColor?: string;
    accentColor?: string;
    logoUrl?: string;
    smsNumber?: string;
    reviewUrl?: string;
  };

  // Business profile gives us a fallback phone number.
  const [profile] = await db
    .select({ phone: businessProfile.phone })
    .from(businessProfile)
    .where(eq(businessProfile.tenantId, row.id))
    .limit(1);

  return NextResponse.json(
    {
      tenantSlug,
      displayName: theme.displayName ?? row.name,
      primaryColor: theme.primaryColor ?? "#5b21b6",
      accentColor: theme.accentColor ?? "#f59e0b",
      logoUrl: theme.logoUrl ?? null,
      smsNumber: theme.smsNumber ?? profile?.phone ?? null,
      reviewUrl: theme.reviewUrl ?? null,
      leadEndpoint: `/api/webhooks/leads/${tenantSlug}`,
    },
    { headers: CORS_HEADERS },
  );
}
