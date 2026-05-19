import { loadActiveSession } from "@/lib/active-tenant";
import { PrintStudio } from "./studio";

export default async function PrintPage() {
  const session = await loadActiveSession();
  return (
    <PrintStudio
      tenantName={session.tenant.name}
      defaults={{
        category: session.profile?.category ?? "",
        phone: session.profile?.phone ?? "",
        website: session.profile?.website ?? "",
        city: session.profile?.address?.city ?? "",
        primaryColor: session.tenant.brandTheme?.primaryColor ?? "#5b21b6",
        accentColor: session.tenant.brandTheme?.accentColor ?? "#f59e0b",
      }}
    />
  );
}
