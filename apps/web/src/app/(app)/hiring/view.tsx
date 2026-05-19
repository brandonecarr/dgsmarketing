"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";

interface Job {
  id: string;
  title: string;
  description: string | null;
  compensation: string | null;
  status: string;
  applicantCount: number;
  createdAt: string;
}

const STATUSES = ["draft", "open", "paused", "closed"] as const;

export function HiringView({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(jobs.length === 0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [compensation, setCompensation] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!title) return;
    setSaving(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          compensation: compensation || undefined,
          status: "draft",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Save failed");
        return;
      }
      setTitle("");
      setDescription("");
      setCompensation("");
      setShowAdd(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: (typeof STATUSES)[number]) {
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this job posting?")) return;
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Hiring Hub</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Track open roles and applicants. Connecting to job boards (Indeed, FB Jobs) is on
                the Phase 10 roadmap.
              </p>
            </div>
            <Button onClick={() => setShowAdd(true)} variant="outline">
              <Plus className="h-4 w-4" /> Post a job
            </Button>
          </div>
        </CardHeader>
      </Card>

      {showAdd ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">New job posting</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Title" value={title} onChange={setTitle} placeholder="Field technician" />
              <Field
                label="Compensation"
                value={compensation}
                onChange={setCompensation}
                placeholder="$18–22/hr + tips"
              />
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Description
              </span>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What the role does, who it's for, why it's a great fit…"
                className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
              />
            </label>
            <div className="flex gap-2">
              <Button onClick={create} disabled={saving || !title}>
                {saving ? "Saving…" : "Save as draft"}
              </Button>
              {jobs.length > 0 ? (
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
          {jobs.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              <Briefcase className="mx-auto mb-2 h-5 w-5" />
              No job postings yet.
            </div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {jobs.map((j) => (
                <li key={j.id} className="px-5 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{j.title}</span>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            j.status === "open"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
                              : j.status === "draft"
                                ? "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100",
                          )}
                        >
                          {j.status}
                        </span>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {j.applicantCount} applicants
                        </span>
                      </div>
                      {j.compensation ? (
                        <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                          {j.compensation}
                        </div>
                      ) : null}
                      {j.description ? (
                        <p className="mt-1 line-clamp-2 text-xs">{j.description}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <select
                        value={j.status}
                        onChange={(e) =>
                          setStatus(j.id, e.target.value as (typeof STATUSES)[number])
                        }
                        className="rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => remove(j.id)}
                        className="rounded-md border border-[hsl(var(--border))] p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
