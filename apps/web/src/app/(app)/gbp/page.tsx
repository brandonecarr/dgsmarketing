import { db, integrations } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import {
  computeCompleteness,
  GbpError,
  listAccounts,
  listLocations,
  listReviews,
} from "@/lib/google/gbp";
import { GbpView } from "./view";

interface ReviewLite {
  id: string;
  reviewer: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  replied: boolean;
}

export default async function GbpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const session = await loadActiveSession();
  const sp = await searchParams;

  const [integ] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, session.tenant.id),
        eq(integrations.provider, "google"),
      ),
    )
    .limit(1);

  const connected = integ?.status === "connected";

  let location: Awaited<ReturnType<typeof listLocations>>[number] | null = null;
  let reviews: ReviewLite[] = [];
  let avgRating: number | null = null;
  let error: string | null = sp.error ?? null;

  if (connected) {
    try {
      const accounts = await listAccounts(session.tenant.id);
      const first = accounts[0];
      if (first) {
        const locations = await listLocations(session.tenant.id, first.name);
        location = locations[0] ?? null;
        if (location) {
          const rs = await listReviews(session.tenant.id, location.name, 12);
          const ratingMap: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
          reviews = rs.map((r) => ({
            id: r.reviewId,
            reviewer: r.reviewer.displayName ?? "Anonymous",
            rating: ratingMap[r.starRating] ?? 0,
            comment: r.comment ?? null,
            createdAt: r.createTime,
            replied: Boolean(r.reviewReply),
          }));
          if (reviews.length > 0) {
            avgRating =
              Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
          }
        }
      }
    } catch (e) {
      if (e instanceof GbpError) {
        error = `GBP: ${e.message}`;
      } else {
        error = e instanceof Error ? e.message : "GBP fetch failed";
      }
    }
  }

  // Completeness from Google when available, falling back to local fields.
  const localFields = [
    { key: "name", label: "Business name", ok: Boolean(session.tenant.name) },
    { key: "phone", label: "Phone", ok: Boolean(session.profile?.phone) },
    { key: "website", label: "Website", ok: Boolean(session.profile?.website) },
    { key: "category", label: "Category", ok: Boolean(session.profile?.category) },
    {
      key: "address",
      label: "Address",
      ok: Boolean(session.profile?.address?.city),
    },
    {
      key: "hours",
      label: "Hours",
      ok: Boolean(session.profile?.hours && Object.keys(session.profile.hours).length > 0),
    },
    { key: "services", label: "Services", ok: (session.profile?.services?.length ?? 0) > 0 },
  ];
  const localPct = Math.round(
    (localFields.filter((f) => f.ok).length / localFields.length) * 100,
  );

  const gbpCompleteness = location ? computeCompleteness(location) : null;

  return (
    <GbpView
      tenantName={session.tenant.name}
      connected={connected}
      justConnected={sp.connected === "1"}
      error={error}
      googleConfigured={Boolean(process.env.GOOGLE_CLIENT_ID)}
      location={
        location
          ? {
              name: location.name,
              title: location.title ?? null,
              address: location.storefrontAddress?.addressLines?.join(", ") ?? null,
              phone: location.primaryPhone ?? null,
              website: location.websiteUri ?? null,
              category: location.categories?.primaryCategory?.displayName ?? null,
              mapsUri: location.metadata?.mapsUri ?? null,
              reviewUri: location.metadata?.newReviewUri ?? null,
            }
          : null
      }
      completeness={
        gbpCompleteness ?? {
          pct: localPct,
          fields: localFields,
        }
      }
      completenessSource={gbpCompleteness ? "google" : "local"}
      reviews={reviews}
      avgRating={avgRating}
    />
  );
}
