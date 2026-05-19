import { NextResponse } from "next/server";
import { buildAuthUrl, getBaseUrl, issueState } from "@/lib/google/oauth";
import { loadActiveSession } from "@/lib/active-tenant";

export const runtime = "nodejs";

export async function GET() {
  const session = await loadActiveSession();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID not configured" },
      { status: 500 },
    );
  }
  const base = await getBaseUrl();
  const state = await issueState(session.tenant.id);
  const url = buildAuthUrl({
    clientId,
    redirectUri: `${base}/api/integrations/google/callback`,
    state,
  });
  return NextResponse.redirect(url, 302);
}
