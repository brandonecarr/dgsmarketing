"use client";

import { useState } from "react";

export function DsarForm() {
  const [kind, setKind] = useState<"export" | "delete">("export");
  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          tenantSlug: tenantSlug.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j.error ?? "Submit failed");
        return;
      }
      setMsg(
        "Got it. We've recorded your request. A human will follow up at the contact you provided within 30 days.",
      );
      setEmail("");
      setPhone("");
      setNotes("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="rosie-public__form" onSubmit={submit}>
      <label className="rosie-public__field">
        <span>Request type</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "export" | "delete")}
          style={{
            border: "1px solid #cfcfd5",
            borderRadius: "0.5rem",
            padding: "0.65rem 0.85rem",
            background: "#fff",
            font: "inherit",
          }}
        >
          <option value="export">Export my data</option>
          <option value="delete">Delete my data</option>
        </select>
      </label>
      <label className="rosie-public__field">
        <span>Business name / handle</span>
        <input
          required
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          placeholder="e.g. scoop-doggy-logs"
        />
      </label>
      <label className="rosie-public__field">
        <span>Your email (preferred)</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="rosie-public__field">
        <span>Your phone</span>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="rosie-public__field">
        <span>Notes (optional)</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {msg ? (
        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #6ee7b7",
            color: "#065f46",
            padding: "0.75rem",
            borderRadius: "0.5rem",
            fontSize: "0.85rem",
          }}
        >
          {msg}
        </div>
      ) : null}
      <button type="submit" disabled={submitting || !tenantSlug || (!email && !phone)}>
        {submitting ? "Sending…" : "Submit request"}
      </button>
    </form>
  );
}
