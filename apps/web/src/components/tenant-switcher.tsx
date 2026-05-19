"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";

export interface TenantMembership {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: string;
}

export function TenantSwitcher({
  active,
  memberships,
}: {
  active: { tenantId: string; tenantName: string };
  memberships: TenantMembership[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  // Single-tenant users get a plain label — no chrome.
  if (memberships.length <= 1) {
    return <div className="text-sm text-[hsl(var(--muted-foreground))]">{active.tenantName}</div>;
  }

  async function pick(tenantId: string) {
    if (tenantId === active.tenantId) {
      setOpen(false);
      return;
    }
    setSwitching(tenantId);
    try {
      await fetch("/api/tenant/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      router.refresh();
    } finally {
      setSwitching(null);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--muted))]"
      >
        <span className="max-w-[180px] truncate font-medium">{active.tenantName}</span>
        <ChevronsUpDown className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-1 shadow-lg">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Switch tenant
          </div>
          {memberships.map((m) => {
            const isActive = m.tenantId === active.tenantId;
            return (
              <button
                key={m.tenantId}
                onClick={() => pick(m.tenantId)}
                disabled={switching !== null}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[hsl(var(--muted))]"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{m.tenantName}</div>
                  <div className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">
                    {m.tenantSlug} · {m.role}
                  </div>
                </div>
                {isActive ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
