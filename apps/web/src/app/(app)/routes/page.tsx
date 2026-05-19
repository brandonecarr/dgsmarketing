import { Card, CardBody, CardHeader } from "@rosie/ui";
import { loadActiveSession } from "@/lib/active-tenant";
import { RoutesView } from "./view";

export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  await loadActiveSession();
  // Surface the publishable Mapbox token to the client so the map can render.
  // No token? The view falls back to a list-only mode.
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Route management</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Pick a day to see every active customer scheduled for it. Hit{" "}
            <strong>Optimize</strong> to reorder them by shortest drive time — Rosie calls Mapbox
            Optimization (≤12 stops) or falls back to a nearest-neighbor sort for larger routes.
          </p>
        </CardHeader>
      </Card>
      <RoutesView mapboxToken={mapboxToken} />
    </div>
  );
}
