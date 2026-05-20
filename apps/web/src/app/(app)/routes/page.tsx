import { Card, CardBody, CardHeader } from "@rosie/ui";
import { loadActiveSession } from "@/lib/active-tenant";
import { RoutesView } from "./view";

export const dynamic = "force-dynamic";

const DEFAULT_WORKING_DAYS = ["mon", "tue", "wed", "thu", "fri"] as const;

export default async function RoutesPage() {
  const session = await loadActiveSession();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? null;

  const theme = (session.tenant.brandTheme ?? {}) as { workingDays?: string[] };
  const workingDays =
    theme.workingDays && theme.workingDays.length > 0
      ? (theme.workingDays as Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">)
      : (DEFAULT_WORKING_DAYS as readonly ("mon" | "tue" | "wed" | "thu" | "fri")[] as Array<
          "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
        >);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Route management</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            <strong>Today&apos;s route</strong> shows the customers already scheduled for the
            selected day and can optimize their visit order. <strong>Weekly planner</strong>{" "}
            re-assigns every customer across your working days so each day&apos;s route is as
            geographically tight as possible.
          </p>
        </CardHeader>
      </Card>
      <RoutesView mapboxToken={mapboxToken} initialWorkingDays={workingDays} />
    </div>
  );
}
