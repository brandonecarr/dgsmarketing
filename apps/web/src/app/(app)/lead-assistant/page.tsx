import { loadActiveSession } from "@/lib/active-tenant";
import { LeadAssistantToggle } from "./toggle";

export default async function LeadAssistantPage() {
  const session = await loadActiveSession();
  return (
    <LeadAssistantToggle
      enabled={session.profile?.features?.leadAssistantEnabled ?? false}
      instruction={session.profile?.features?.leadAssistantInstruction ?? ""}
    />
  );
}
