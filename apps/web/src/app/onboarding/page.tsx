import { redirect } from "next/navigation";
import { OnboardingForm } from "./form";
import { getSupabaseServer } from "@/lib/supabase/server";
import { db, memberships, tenants } from "@rosie/db";
import { eq } from "@rosie/db";
import { availableRegions } from "@/lib/regions";

export default async function OnboardingPage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const existing = await db
    .select({ tenantId: memberships.tenantId })
    .from(memberships)
    .where(eq(memberships.userId, data.user.id))
    .limit(1);

  if (existing.length > 0) {
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, existing[0]!.tenantId))
      .limit(1);
    if (tenant[0]) redirect("/overview");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <OnboardingForm
        userId={data.user.id}
        email={data.user.email ?? ""}
        regions={availableRegions()}
      />
    </div>
  );
}
