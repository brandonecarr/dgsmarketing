"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, Button } from "@rosie/ui";

interface Member {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  joinedAt: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

const ROLES = ["owner", "operator", "staff", "client"] as const;

export function PeopleView({
  currentUserId,
  currentUserRole,
  members,
  pendingInvites,
}: {
  currentUserId: string;
  currentUserRole: string;
  members: Member[];
  pendingInvites: Invite[];
}) {
  const router = useRouter();
  const canInvite = currentUserRole === "owner" || currentUserRole === "operator";
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("operator");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function invite() {
    if (!email) return;
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j.error ?? "Invite failed");
        return;
      }
      setMsg(`Invite sent to ${email}.`);
      setEmail("");
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this pending invite?")) return;
    await fetch(`/api/invitations/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">People</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Team members for this business. Invites expire in 7 days.
          </p>
        </CardHeader>
      </Card>

      {canInvite ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Invite a teammate</h3>
          </CardHeader>
          <CardBody className="space-y-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_auto]">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
                className="rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <Button onClick={invite} disabled={sending || !email}>
                <UserPlus className="h-4 w-4" /> {sending ? "Sending…" : "Send invite"}
              </Button>
            </div>
            {msg ? <div className="text-xs text-[hsl(var(--muted-foreground))]">{msg}</div> : null}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">Members ({members.length})</h3>
        </CardHeader>
        <CardBody className="p-0">
          <ul className="divide-y divide-[hsl(var(--border))]">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-semibold">
                    {m.fullName ?? m.email}
                    {m.userId === currentUserId ? (
                      <span className="ml-2 rounded-full bg-rosie-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rosie-700 dark:bg-rosie-950 dark:text-rosie-200">
                        you
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    {m.email} · joined {new Date(m.joinedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  {m.role}
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {pendingInvites.length > 0 ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Pending invitations</h3>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-[hsl(var(--border))]">
              {pendingInvites.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <div>
                    <div className="font-semibold">{i.email}</div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {i.role} · expires {new Date(i.expiresAt).toLocaleString()}
                    </div>
                  </div>
                  {canInvite ? (
                    <button
                      onClick={() => revoke(i.id)}
                      className="rounded-md border border-[hsl(var(--border))] p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      aria-label="Revoke"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
