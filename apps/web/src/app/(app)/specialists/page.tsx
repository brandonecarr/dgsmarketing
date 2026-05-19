import { db, specialists } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { SpecialistsView } from "./view";

export default async function SpecialistsPage() {
  const session = await loadActiveSession();
  const rows = await db
    .select()
    .from(specialists)
    .where(eq(specialists.tenantId, session.tenant.id))
    .orderBy(desc(specialists.createdAt));
  return (
    <SpecialistsView
      rows={rows.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        phone: r.phone,
        email: r.email,
        notes: r.notes,
        active: r.active,
      }))}
    />
  );
}
