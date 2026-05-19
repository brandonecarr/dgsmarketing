import { NextResponse } from "next/server";
import { db, adCampaigns } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { setCampaignStatus } from "@/lib/ads/actions";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;

  const [campaign] = await db
    .select()
    .from(adCampaigns)
    .where(and(eq(adCampaigns.id, id), eq(adCampaigns.tenantId, session.tenant.id)))
    .limit(1);
  if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });

  const result = await setCampaignStatus({
    tenantId: session.tenant.id,
    campaignRowId: campaign.id,
    target: "paused",
  });
  return NextResponse.json(result);
}
