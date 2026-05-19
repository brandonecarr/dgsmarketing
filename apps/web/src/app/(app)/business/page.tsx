import { loadActiveSession } from "@/lib/active-tenant";
import { BusinessForm } from "./form";

export default async function BusinessPage() {
  const session = await loadActiveSession();
  return (
    <BusinessForm
      tenantId={session.tenant.id}
      initial={{
        name: session.tenant.name,
        category: session.profile?.category ?? "",
        city: session.profile?.address?.city ?? "",
        services: session.profile?.services ?? [],
        brandVoice: session.profile?.brandVoice ?? {},
      }}
    />
  );
}
