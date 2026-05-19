import { db, creatives } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { ImageCreator } from "./creator";

export default async function ImagesPage() {
  const session = await loadActiveSession();
  const recent = await db
    .select()
    .from(creatives)
    .where(eq(creatives.tenantId, session.tenant.id))
    .orderBy(desc(creatives.createdAt))
    .limit(12);

  return (
    <ImageCreator
      recent={recent.map((r) => ({
        id: r.id,
        name: r.name,
        url: r.url,
        format: r.format,
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  );
}
