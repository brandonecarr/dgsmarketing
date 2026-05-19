"use client";

import { useRouter } from "next/navigation";
import { Button } from "@rosie/ui";

export function CommercialActions({ leadId }: { leadId: string }) {
  const router = useRouter();
  async function unmark() {
    if (!confirm("Remove commercial flag?")) return;
    await fetch(`/api/leads/${leadId}/commercial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCommercial: false }),
    });
    router.refresh();
  }
  return (
    <Button size="sm" variant="outline" onClick={unmark}>
      Unmark
    </Button>
  );
}
