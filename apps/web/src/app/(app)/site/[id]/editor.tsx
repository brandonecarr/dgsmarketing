"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, Button } from "@rosie/ui";

type FormFieldType = "text" | "tel" | "email" | "textarea";
interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
}

interface Content {
  headline?: string;
  subhead?: string;
  bullets?: string[];
  ctaPrimary?: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  promoCode?: string;
  reviewUrl?: string;
  formFields?: FormField[];
}

interface Theme {
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
}

interface Props {
  baseUrl: string;
  page: {
    id: string;
    slug: string;
    title: string;
    template: string;
    status: string;
    content: Content;
    theme: Theme;
  };
}

export function SiteEditor({ baseUrl, page: initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState<Content>(initial.content);
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [bulletsText, setBulletsText] = useState((initial.content.bullets ?? []).join("\n"));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  async function save(patch?: { status?: "draft" | "published" | "archived" }) {
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch(`/api/landing-pages/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status: patch?.status,
          content: {
            ...content,
            bullets: bulletsText
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          },
          theme,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error ?? "Save failed");
        return;
      }
      setSaved(new Date().toLocaleTimeString());
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function deletePage() {
    if (!confirm("Delete this landing page?")) return;
    await fetch(`/api/landing-pages/${initial.id}`, { method: "DELETE" });
    router.push("/site");
  }

  const publicUrl = `${baseUrl}/p/${initial.slug}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <a href="/site" className="text-xs text-rosie-700 hover:underline">
                ← Site Builder
              </a>
              <h2 className="mt-1 text-xl font-bold">{initial.title}</h2>
              <p className="text-xs font-mono text-[hsl(var(--muted-foreground))]">{publicUrl}</p>
              <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Template: {initial.template} · Status: {initial.status}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/p/${initial.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs hover:bg-[hsl(var(--muted))]"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Preview
              </a>
              <Button variant="outline" onClick={() => save()} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save draft"}
              </Button>
              {initial.status !== "published" ? (
                <Button onClick={() => save({ status: "published" })} disabled={saving}>
                  Publish
                </Button>
              ) : (
                <Button variant="outline" onClick={() => save({ status: "draft" })} disabled={saving}>
                  Unpublish
                </Button>
              )}
              <Button variant="ghost" onClick={deletePage}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          </div>
          {saved ? <p className="mt-2 text-xs text-emerald-600">Saved at {saved}.</p> : null}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">Content</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="Page title (internal)" value={title} onChange={setTitle} />
          <Field
            label="Headline"
            value={content.headline ?? ""}
            onChange={(v) => setContent((c) => ({ ...c, headline: v }))}
          />
          <Field
            label="Sub-headline"
            value={content.subhead ?? ""}
            onChange={(v) => setContent((c) => ({ ...c, subhead: v }))}
          />
          <TextArea
            label="Bullets (one per line)"
            value={bulletsText}
            onChange={setBulletsText}
            rows={4}
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Primary CTA — label"
              value={content.ctaPrimary?.label ?? ""}
              onChange={(v) =>
                setContent((c) => ({
                  ...c,
                  ctaPrimary: { ...(c.ctaPrimary ?? { label: "", href: "" }), label: v },
                }))
              }
            />
            <Field
              label="Primary CTA — link"
              value={content.ctaPrimary?.href ?? ""}
              onChange={(v) =>
                setContent((c) => ({
                  ...c,
                  ctaPrimary: { ...(c.ctaPrimary ?? { label: "", href: "" }), href: v },
                }))
              }
            />
            <Field
              label="Secondary CTA — label"
              value={content.ctaSecondary?.label ?? ""}
              onChange={(v) =>
                setContent((c) => ({
                  ...c,
                  ctaSecondary: { ...(c.ctaSecondary ?? { label: "", href: "" }), label: v },
                }))
              }
            />
            <Field
              label="Secondary CTA — link"
              value={content.ctaSecondary?.href ?? ""}
              onChange={(v) =>
                setContent((c) => ({
                  ...c,
                  ctaSecondary: { ...(c.ctaSecondary ?? { label: "", href: "" }), href: v },
                }))
              }
            />
          </div>
          {initial.template === "promo" ? (
            <Field
              label="Promo code"
              value={content.promoCode ?? ""}
              onChange={(v) => setContent((c) => ({ ...c, promoCode: v }))}
            />
          ) : null}
          {initial.template === "review_request" ? (
            <Field
              label="Google review URL"
              value={content.reviewUrl ?? ""}
              onChange={(v) => setContent((c) => ({ ...c, reviewUrl: v }))}
            />
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Form fields</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                What the visitor fills in. Each field is one input on the public page; a TCPA
                consent checkbox is auto-added when any field has type "tel".
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                setContent((c) => ({
                  ...c,
                  formFields: [
                    ...(c.formFields ?? []),
                    { name: `field_${(c.formFields?.length ?? 0) + 1}`, label: "", type: "text", required: false },
                  ],
                }))
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add field
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-2">
          {(content.formFields ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 text-center text-xs text-[hsl(var(--muted-foreground))]">
              No fields yet — visitors will see your headline but won't be able to submit a lead.
            </p>
          ) : null}
          {(content.formFields ?? []).map((f, i) => (
            <div
              key={i}
              className="grid grid-cols-12 items-end gap-2 rounded-md border border-[hsl(var(--border))] p-2"
            >
              <div className="col-span-3">
                <Field
                  label="Name (slug)"
                  value={f.name}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      formFields: (c.formFields ?? []).map((row, idx) =>
                        idx === i ? { ...row, name: v.toLowerCase().replace(/[^a-z0-9_]/g, "_") } : row,
                      ),
                    }))
                  }
                />
              </div>
              <div className="col-span-4">
                <Field
                  label="Label"
                  value={f.label}
                  onChange={(v) =>
                    setContent((c) => ({
                      ...c,
                      formFields: (c.formFields ?? []).map((row, idx) =>
                        idx === i ? { ...row, label: v } : row,
                      ),
                    }))
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Type
                  </span>
                  <select
                    value={f.type}
                    onChange={(e) =>
                      setContent((c) => ({
                        ...c,
                        formFields: (c.formFields ?? []).map((row, idx) =>
                          idx === i ? { ...row, type: e.target.value as FormFieldType } : row,
                        ),
                      }))
                    }
                    className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
                  >
                    <option value="text">text</option>
                    <option value="tel">tel</option>
                    <option value="email">email</option>
                    <option value="textarea">textarea</option>
                  </select>
                </label>
              </div>
              <label className="col-span-2 flex items-center gap-2 pb-2 text-xs">
                <input
                  type="checkbox"
                  checked={!!f.required}
                  onChange={(e) =>
                    setContent((c) => ({
                      ...c,
                      formFields: (c.formFields ?? []).map((row, idx) =>
                        idx === i ? { ...row, required: e.target.checked } : row,
                      ),
                    }))
                  }
                />
                Required
              </label>
              <button
                type="button"
                onClick={() =>
                  setContent((c) => ({
                    ...c,
                    formFields: (c.formFields ?? []).filter((_, idx) => idx !== i),
                  }))
                }
                className="col-span-1 flex items-center justify-center rounded-md border border-[hsl(var(--border))] py-2 text-xs hover:bg-red-50 hover:text-red-700"
                aria-label="Remove field"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">Theme</h3>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ColorField
            label="Primary color"
            value={theme.primaryColor ?? "#5b21b6"}
            onChange={(v) => setTheme((t) => ({ ...t, primaryColor: v }))}
          />
          <ColorField
            label="Accent color"
            value={theme.accentColor ?? "#f59e0b"}
            onChange={(v) => setTheme((t) => ({ ...t, accentColor: v }))}
          />
          <ColorField
            label="Background"
            value={theme.backgroundColor ?? "#ffffff"}
            onChange={(v) => setTheme((t) => ({ ...t, backgroundColor: v }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded-md border border-[hsl(var(--border))] bg-transparent"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-rosie-500"
        />
      </div>
    </label>
  );
}
