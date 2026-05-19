import { Card, CardBody, CardHeader } from "@rosie/ui";
import { db, customers } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { CustomersView } from "./view";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const session = await loadActiveSession();

  const rows = await db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, session.tenant.id))
    .orderBy(desc(customers.updatedAt))
    .limit(500);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Customers</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Recurring-service customers. Add them manually, import a CSV, or convert won leads
            here. Addresses are geocoded automatically so they show up on the route map.
          </p>
        </CardHeader>
      </Card>
      <CustomersView
        initial={rows.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          email: r.email,
          address: r.address,
          serviceDays: r.serviceDays,
          serviceWindow: r.serviceWindow,
          zone: r.zone,
          status: r.status,
          notes: r.notes,
          pricePerVisitCents: r.pricePerVisitCents,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
