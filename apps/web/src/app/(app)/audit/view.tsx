"use client";

import { useState } from "react";
import { Card, CardBody, cn } from "@rosie/ui";

interface Row {
  id: string;
  action: string;
  summary: string | null;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown> | null;
  actor: string;
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  "integration.connect": "Integration connected",
  "integration.disconnect": "Integration disconnected",
  "integration.update": "Integration updated",
  "api_key.create": "API key created",
  "api_key.revoke": "API key revoked",
  "member.invite": "Member invited",
  "member.accept": "Member accepted",
  "member.revoke": "Invite revoked",
  "member.role_change": "Role changed",
  "billing.checkout": "Billing checkout",
  "billing.portal": "Billing portal opened",
  "billing.subscription_change": "Subscription changed",
  "branding.update": "Branding updated",
  "spend_budget.update": "Spend budget changed",
  "tenant.update": "Tenant updated",
  "impersonation.start": "Impersonation started",
  "impersonation.end": "Impersonation ended",
  "lead.export": "Leads exported",
  "data.delete_request": "Data deletion requested",
};

export function AuditView({
  rows,
  activeFilter,
}: {
  rows: Row[];
  activeFilter: string | null;
}) {
  const allActions = Array.from(new Set(rows.map((r) => r.action)));
  const [filter, setFilter] = useState<string | null>(activeFilter);
  const filtered = filter ? rows.filter((r) => r.action === filter) : rows;
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      {allActions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filter === null} onClick={() => setFilter(null)}>
            All
          </FilterChip>
          {allActions.map((a) => (
            <FilterChip key={a} active={filter === a} onClick={() => setFilter(a)}>
              {ACTION_LABEL[a] ?? a}
            </FilterChip>
          ))}
        </div>
      ) : null}

      <Card>
        <CardBody className="p-0">
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              Nothing yet.
            </div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {filtered.map((r) => (
                <li key={r.id} className="px-5 py-3 text-sm">
                  <button
                    onClick={() => setExpanded((p) => (p === r.id ? null : r.id))}
                    className="block w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                            {ACTION_LABEL[r.action] ?? r.action}
                          </span>
                          <span className="font-semibold">{r.summary ?? "—"}</span>
                        </div>
                        <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                          {r.actor} · {new Date(r.createdAt).toLocaleString()}
                          {r.entityType ? ` · ${r.entityType}` : ""}
                        </div>
                      </div>
                    </div>
                    {expanded === r.id && r.payload ? (
                      <pre className="mt-2 overflow-x-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2 text-[10px]">
                        {JSON.stringify(r.payload, null, 2)}
                      </pre>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition",
        active
          ? "border-rosie-600 bg-rosie-50 text-rosie-700 dark:bg-rosie-950 dark:text-rosie-200"
          : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
      )}
    >
      {children}
    </button>
  );
}
