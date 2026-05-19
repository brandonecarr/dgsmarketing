import { NextResponse } from "next/server";
import { db, tenants, memberships, users } from "@rosie/db";
import { and, eq, inArray } from "@rosie/db";
import { headers } from "next/headers";
import { buildWeeklyRecap, renderRecapEmail } from "@/lib/coaching/recap";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Weekly recap drain. Iterates every tenant, builds the recap, and emails it
 * to the tenant's owners + operators (one email per recipient).
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`. Intended to be invoked from
 * Vercel Cron or any external scheduler once a week.
 */
export async function POST(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "1";

  const baseUrl = await resolveBaseUrl();

  const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);
  let sent = 0;
  let skipped = 0;
  const errors: Array<{ tenantId: string; error: string }> = [];

  for (const tenant of allTenants) {
    try {
      const recap = await buildWeeklyRecap(tenant);
      // Skip tenants that did nothing — no signal for the recipient.
      if (
        recap.newLeads === 0 &&
        recap.inbound === 0 &&
        recap.outbound === 0 &&
        recap.postsPublished === 0
      ) {
        skipped++;
        continue;
      }
      const { subject, html } = renderRecapEmail(recap, baseUrl);

      const recipients = await db
        .select({ email: users.email })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(
          and(
            eq(memberships.tenantId, tenant.id),
            inArray(memberships.role, ["owner", "operator"]),
          ),
        );
      const to = recipients.map((r) => r.email).filter((e): e is string => Boolean(e));
      if (to.length === 0) {
        skipped++;
        continue;
      }

      if (!dryRun) {
        await sendEmail({
          to,
          subject,
          html,
          tags: [
            { name: "kind", value: "weekly_recap" },
            { name: "tenant", value: tenant.id },
          ],
        });
      }
      sent++;
    } catch (e) {
      errors.push({
        tenantId: tenant.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, errors, dryRun });
}

async function resolveBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
