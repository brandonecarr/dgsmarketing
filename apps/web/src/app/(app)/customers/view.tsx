"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Trash2, Save, X } from "lucide-react";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";

const SERVICE_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type ServiceDay = (typeof SERVICE_DAYS)[number];
type Status = "active" | "paused" | "cancelled";

interface Address {
  street?: string;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: Address | null;
  serviceDays: ServiceDay[];
  serviceWindow: string | null;
  zone: string | null;
  status: Status;
  notes: string | null;
  pricePerVisitCents: number | null;
  createdAt: string;
}

const STATUS_TONE: Record<Status, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100",
  cancelled: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export function CustomersView({ initial }: { initial: CustomerRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [filter, setFilter] = useState<Status | null>(null);
  const [query, setQuery] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<{
    created: number;
    failed: number;
    total: number;
    errors: Array<{ rowIndex: number; error: string }>;
  } | null>(null);

  const visible = useMemo(() => {
    let out = rows;
    if (filter) out = out.filter((r) => r.status === filter);
    if (query) {
      const q = query.toLowerCase();
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.phone?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.address?.city?.toLowerCase().includes(q) ||
          r.zone?.toLowerCase().includes(q),
      );
    }
    return out;
  }, [rows, filter, query]);

  async function refresh() {
    const res = await fetch("/api/customers");
    if (!res.ok) return;
    const j = await res.json();
    setRows(j.data ?? []);
  }

  async function importCsv(file: File) {
    setImporting(true);
    setImportReport(null);
    try {
      const text = await file.text();
      const records = parseCsv(text);
      if (records.length === 0) {
        alert("Couldn't read any rows from that CSV. Check that the first row is a header row.");
        return;
      }
      const res = await fetch("/api/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: records }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error ?? "Import failed");
        return;
      }
      const errors: Array<{ rowIndex: number; error: string }> = (j.report ?? [])
        .filter((r: { ok: boolean }) => !r.ok)
        .slice(0, 20);
      setImportReport({
        created: j.created ?? 0,
        failed: j.failed ?? 0,
        total: j.total ?? records.length,
        errors,
      });
      await refresh();
      router.refresh();
    } finally {
      setImporting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this customer? Their visit history is removed too.")) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip active={filter === null} onClick={() => setFilter(null)}>
                All · {rows.length}
              </FilterChip>
              {(["active", "paused", "cancelled"] as const).map((s) => (
                <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
                  {s} · {rows.filter((r) => r.status === s).length}
                </FilterChip>
              ))}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, phone, email, city…"
                className="rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-xs"
              />
            </div>
            <div className="flex gap-2">
              <input
                ref={importRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importCsv(f);
                  e.target.value = "";
                }}
              />
              <Button variant="outline" onClick={() => importRef.current?.click()} disabled={importing}>
                <Upload className="h-3.5 w-3.5" /> {importing ? "Importing…" : "Import CSV"}
              </Button>
              <Button onClick={() => { setEditing(null); setShowForm(true); }}>
                <Plus className="h-3.5 w-3.5" /> Add customer
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {showForm ? (
        <CustomerForm
          initial={editing}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            await refresh();
            router.refresh();
          }}
        />
      ) : null}

      {importReport ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">
                  Import: {importReport.created} of {importReport.total} added
                  {importReport.failed > 0 ? ` · ${importReport.failed} failed` : ""}
                </h3>
                {importReport.failed === 0 ? (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Everything imported cleanly.
                  </p>
                ) : (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    First {importReport.errors.length} errors shown below — the rest are the same
                    issue.
                  </p>
                )}
              </div>
              <button
                onClick={() => setImportReport(null)}
                aria-label="Dismiss"
                className="rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs"
              >
                Dismiss
              </button>
            </div>
          </CardHeader>
          {importReport.errors.length > 0 ? (
            <CardBody className="p-0">
              <ul className="divide-y divide-[hsl(var(--border))]">
                {importReport.errors.map((e) => (
                  <li
                    key={e.rowIndex}
                    className="flex items-start gap-3 px-5 py-2 text-[12px]"
                  >
                    <span className="shrink-0 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                      Row {e.rowIndex + 2}
                    </span>
                    <span className="text-red-700 dark:text-red-300">{e.error}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-5 py-3 text-[11px] text-[hsl(var(--muted-foreground))]">
                Most "name: Required" errors mean your CSV's name column has a different header.
                Accepted variants: <code>name</code>, <code>Customer</code>, <code>Full Name</code>,{" "}
                <code>Client</code>. Same flexibility for <code>phone</code> (Phone Number, Mobile),
                <code> street</code> (Address, Address Line 1), <code>postal</code> (Zip, Zip
                Code), <code>region</code> (State), and <code>serviceDays</code> (Days, Schedule).
              </div>
            </CardBody>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardBody className="p-0">
          {visible.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-[hsl(var(--muted-foreground))]">
              {rows.length === 0
                ? "No customers yet. Add one above or import a CSV — the expected columns are name, phone, email, street, city, region, postal, serviceDays (eg \"mon,thu\"), zone, notes, pricePerVisit (dollars)."
                : "Nothing matches that filter."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(var(--muted))] text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Address</th>
                    <th className="px-3 py-2 text-left">Days</th>
                    <th className="px-3 py-2 text-left">Zone</th>
                    <th className="px-3 py-2 text-right">$ / visit</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {visible.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">
                        <div className="font-semibold">{r.name}</div>
                        {r.phone || r.email ? (
                          <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                            {[r.phone, r.email].filter(Boolean).join(" · ")}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-[12px]">
                        {r.address
                          ? [r.address.street, r.address.city, r.address.region, r.address.postal]
                              .filter(Boolean)
                              .join(", ") || "—"
                          : "—"}
                        {r.address && (r.address.lat == null || r.address.lng == null) ? (
                          <span title="Not geocoded yet" className="ml-1 text-[10px] text-amber-700">⚠</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-0.5">
                          {r.serviceDays.length === 0 ? (
                            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">on-demand</span>
                          ) : (
                            r.serviceDays.map((d) => (
                              <span
                                key={d}
                                className="rounded bg-rosie-100 px-1 py-0.5 text-[9px] font-bold uppercase text-rosie-700 dark:bg-rosie-950 dark:text-rosie-200"
                              >
                                {d}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[12px]">{r.zone ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-[12px]">
                        {r.pricePerVisitCents != null
                          ? `$${(r.pricePerVisitCents / 100).toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                            STATUS_TONE[r.status],
                          )}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => { setEditing(r); setShowForm(true); }}
                          className="rounded-md border border-[hsl(var(--border))] px-2 py-1 text-[11px] hover:bg-[hsl(var(--muted))]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(r.id)}
                          className="ml-1 rounded-md border border-[hsl(var(--border))] p-1 text-red-700 hover:bg-red-50 dark:text-red-300"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        active
          ? "border-rosie-600 bg-rosie-50 text-rosie-700 dark:bg-rosie-950 dark:text-rosie-200"
          : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
      )}
    >
      {children}
    </button>
  );
}

function CustomerForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: CustomerRow | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [street, setStreet] = useState(initial?.address?.street ?? "");
  const [city, setCity] = useState(initial?.address?.city ?? "");
  const [region, setRegion] = useState(initial?.address?.region ?? "");
  const [postal, setPostal] = useState(initial?.address?.postal ?? "");
  const [country, setCountry] = useState(initial?.address?.country ?? "US");
  const [zone, setZone] = useState(initial?.zone ?? "");
  const [serviceWindow, setServiceWindow] = useState(initial?.serviceWindow ?? "");
  const [serviceDays, setServiceDays] = useState<ServiceDay[]>(initial?.serviceDays ?? []);
  const [status, setStatus] = useState<Status>(initial?.status ?? "active");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [priceDollars, setPriceDollars] = useState(
    initial?.pricePerVisitCents != null ? (initial.pricePerVisitCents / 100).toFixed(2) : "",
  );
  const [saving, setSaving] = useState(false);

  function toggleDay(d: ServiceDay) {
    setServiceDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        zone: zone.trim() || undefined,
        serviceWindow: serviceWindow.trim() || undefined,
        serviceDays,
        notes: notes.trim() || undefined,
        status,
      };
      const addrFields = { street, city, region, postal, country };
      if (Object.values(addrFields).some((v) => v.trim().length > 0)) {
        body.address = {
          street: street.trim() || undefined,
          city: city.trim() || undefined,
          region: region.trim() || undefined,
          postal: postal.trim() || undefined,
          country: country.trim() || undefined,
        };
      } else if (initial) {
        body.address = null;
      }
      if (priceDollars.trim().length > 0) {
        const n = Number(priceDollars);
        if (Number.isFinite(n)) body.pricePerVisitCents = Math.round(n * 100);
      }
      const url = initial ? `/api/customers/${initial.id}` : "/api/customers";
      const method = initial ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Save failed");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {initial ? "Edit customer" : "Add customer"}
          </h3>
          <button onClick={onCancel} aria-label="Close" className="p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Field label="Name" value={name} onChange={setName} required />
          <Field label="Phone" value={phone} onChange={setPhone} />
          <Field label="Email" value={email} onChange={setEmail} type="email" />
          <Field label="Zone (eg north)" value={zone} onChange={setZone} />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Field label="Street" value={street} onChange={setStreet} />
          <Field label="City" value={city} onChange={setCity} />
          <Field label="Region / State" value={region} onChange={setRegion} />
          <Field label="Postal code" value={postal} onChange={setPostal} />
          <Field label="Country" value={country} onChange={setCountry} />
          <Field
            label="Service window (eg 8am-12pm)"
            value={serviceWindow}
            onChange={setServiceWindow}
          />
        </div>
        <div>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Service days
          </span>
          <div className="flex flex-wrap gap-1">
            {SERVICE_DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase",
                  serviceDays.includes(d)
                    ? "border-rosie-600 bg-rosie-50 text-rosie-700 dark:bg-rosie-950 dark:text-rosie-200"
                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Field
            label="Price per visit ($)"
            value={priceDollars}
            onChange={setPriceDollars}
            type="number"
            placeholder="89.00"
          />
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-2 text-sm"
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Ops notes
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Gate code 4321, two dogs (Max + Luna), leave bag in side gate"
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-2 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving || !name.trim()}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
      />
    </label>
  );
}

/**
 * Minimal RFC-4180-ish CSV parser. Handles quoted fields with commas + escaped
 * double-quotes ("") inside quotes. Returns objects keyed by the header row.
 */
function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.length > 0)) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((v) => v.length > 0)) rows.push(row);
  }
  if (rows.length < 2) return [];
  const headers = rows[0]!.map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? "").trim();
    });
    return obj;
  });
}
