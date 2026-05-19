"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users } from "lucide-react";
import { Card, CardBody, CardHeader, Button } from "@rosie/ui";

interface Row {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
}

export function SpecialistsView({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(rows.length === 0);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/specialists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category: category || null,
          phone: phone || null,
          email: email || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Save failed");
        return;
      }
      setName("");
      setCategory("");
      setPhone("");
      setEmail("");
      setNotes("");
      setShowAdd(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this specialist?")) return;
    await fetch(`/api/specialists/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Specialists</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Vendor + contractor directory for the work you outsource (overflow, specialty,
                emergency).
              </p>
            </div>
            <Button onClick={() => setShowAdd(true)} variant="outline">
              <Plus className="h-4 w-4" /> Add specialist
            </Button>
          </div>
        </CardHeader>
      </Card>

      {showAdd ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">New specialist</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Name" value={name} onChange={setName} placeholder="John's Tree Service" />
              <Field label="Category" value={category} onChange={setCategory} placeholder="Tree removal" />
              <Field label="Phone" value={phone} onChange={setPhone} />
              <Field label="Email" value={email} onChange={setEmail} />
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Notes
              </span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reliable. Same-day on emergencies. 10% kickback on referrals."
                className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
              />
            </label>
            <div className="flex gap-2">
              <Button onClick={create} disabled={saving || !name}>
                {saving ? "Saving…" : "Save specialist"}
              </Button>
              {rows.length > 0 ? (
                <Button variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              <Users className="mx-auto mb-2 h-5 w-5" />
              No specialists yet.
            </div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {rows.map((r) => (
                <li key={r.id} className="px-5 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        {r.category}
                        {r.phone ? ` · ${r.phone}` : ""}
                        {r.email ? ` · ${r.email}` : ""}
                      </div>
                      {r.notes ? (
                        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{r.notes}</p>
                      ) : null}
                    </div>
                    <button
                      onClick={() => remove(r.id)}
                      className="rounded-md border border-[hsl(var(--border))] p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
      />
    </label>
  );
}
