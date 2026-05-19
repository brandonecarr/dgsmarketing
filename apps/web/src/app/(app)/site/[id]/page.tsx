import { db, landingPages } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { loadActiveSession } from "@/lib/active-tenant";
import { SiteEditor } from "./editor";

async function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await loadActiveSession();
  const base = await getBaseUrl();
  const [page] = await db
    .select()
    .from(landingPages)
    .where(and(eq(landingPages.id, id), eq(landingPages.tenantId, session.tenant.id)))
    .limit(1);
  if (!page) notFound();
  return (
    <SiteEditor
      baseUrl={base}
      page={{
        id: page.id,
        slug: page.slug,
        title: page.title,
        template: page.template,
        status: page.status,
        content: page.content ?? {},
        theme: page.theme ?? {},
      }}
    />
  );
}
