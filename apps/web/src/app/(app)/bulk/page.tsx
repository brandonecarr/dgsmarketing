import { db, bulkMessages } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { BulkView } from "./view";

export default async function BulkPage() {
  const session = await loadActiveSession();
  const rows = await db
    .select()
    .from(bulkMessages)
    .where(eq(bulkMessages.tenantId, session.tenant.id))
    .orderBy(desc(bulkMessages.createdAt));

  return (
    <BulkView
      messages={rows.map((m) => ({
        id: m.id,
        name: m.name,
        body: m.body,
        status: m.status,
        recipientCount: m.recipientCount ? Number(m.recipientCount) : 0,
        createdAt: m.createdAt.toISOString(),
        sentAt: m.sentAt ? m.sentAt.toISOString() : null,
      }))}
    />
  );
}
