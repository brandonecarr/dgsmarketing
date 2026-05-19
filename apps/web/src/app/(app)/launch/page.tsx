import { Card, CardBody, CardHeader } from "@rosie/ui";
import { loadActiveSession } from "@/lib/active-tenant";
import { LaunchView } from "./view";

export default async function LaunchPage() {
  const session = await loadActiveSession();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Quick Launch</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            One click → four assets ready to review: an FB post, a landing page,
            a tracked QR pointing at it, and a draft SMS blast to your Won list. Nothing publishes
            or sends automatically — you review and ship.
          </p>
        </CardHeader>
      </Card>
      <LaunchView tenantName={session.tenant.name} />
    </div>
  );
}
