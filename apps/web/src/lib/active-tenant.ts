import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "@rosie/db";
import { db, memberships, tenants, businessProfile } from "@rosie/db";
import { getSupabaseServer } from "./supabase/server";

export const ACTIVE_TENANT_COOKIE = "rosie:active-tenant";

/**
 * Loads the current user, the active tenant (cookie-pinned if the user has
 * multiple memberships, otherwise their only one), and the full membership
 * list so the topbar switcher can render.
 */
export async function loadActiveSession() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const rows = await db
    .select({ tenant: tenants, role: memberships.role })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(eq(memberships.userId, data.user.id));

  if (rows.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const pinned = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;
  const active = rows.find((r) => r.tenant.id === pinned) ?? rows[0]!;

  const profile = await db
    .select()
    .from(businessProfile)
    .where(eq(businessProfile.tenantId, active.tenant.id))
    .limit(1);

  return {
    user: data.user,
    tenant: active.tenant,
    role: active.role,
    profile: profile[0] ?? null,
    memberships: rows.map((r) => ({
      tenantId: r.tenant.id,
      tenantSlug: r.tenant.slug,
      tenantName: r.tenant.name,
      role: r.role,
    })),
  };
}
