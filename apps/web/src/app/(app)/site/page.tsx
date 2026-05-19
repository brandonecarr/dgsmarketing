import { db, landingPages } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { headers } from "next/headers";
import { loadActiveSession } from "@/lib/active-tenant";
import { SiteList } from "./list";

async function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function SitePage() {
  const session = await loadActiveSession();
  const base = await getBaseUrl();
  const pages = await db
    .select()
    .from(landingPages)
    .where(eq(landingPages.tenantId, session.tenant.id))
    .orderBy(desc(landingPages.createdAt));

  return (
    <SiteList
      baseUrl={base}
      pages={pages.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        template: p.template,
        status: p.status,
        viewCount: p.viewCount,
        conversionCount: p.conversionCount,
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  );
}
