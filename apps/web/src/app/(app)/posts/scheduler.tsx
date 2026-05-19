"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, PencilLine, Sparkles, Save } from "lucide-react";
import { Card, CardBody, CardHeader, Button, cn } from "@rosie/ui";

type Platform = "facebook" | "instagram" | "google_business" | "linkedin" | "tiktok";

const PLATFORMS: Array<{ key: Platform; label: string }> = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "google_business", label: "Google Business" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "tiktok", label: "TikTok" },
];

interface ScheduledItem {
  id: string;
  platform: string;
  status: string;
  body: string;
  scheduledFor: string | null;
  createdAt: string;
}

interface CalendarItem {
  date: string;
  topic: string;
  characterName?: string;
  body?: string;
  drafting?: boolean;
}

interface Props {
  hasBrandVoice: boolean;
  tenantName: string;
  characters: string[];
  scheduled: ScheduledItem[];
}

export function PostScheduler({ hasBrandVoice, tenantName, characters, scheduled }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"compose" | "calendar" | "scheduled">("compose");
  const [platform, setPlatform] = useState<Platform>("facebook");

  // Compose state
  const [topic, setTopic] = useState("");
  const [characterName, setCharacterName] = useState<string>("");
  const [draftBody, setDraftBody] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [saving, setSaving] = useState(false);

  // Calendar state
  const [weeks, setWeeks] = useState<2 | 4>(2);
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [planning, setPlanning] = useState(false);

  async function draft() {
    setDrafting(true);
    try {
      const res = await fetch("/api/posts/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, topic: topic || undefined, characterName: characterName || undefined }),
      });
      const json = (await res.json()) as { body?: string; error?: string };
      if (!res.ok) {
        alert(json.error ?? `Draft failed (${res.status})`);
        return;
      }
      if (json.body) setDraftBody(json.body);
    } finally {
      setDrafting(false);
    }
  }

  async function save({ schedule }: { schedule: boolean }) {
    if (!draftBody.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          body: draftBody.trim(),
          scheduledFor: schedule && scheduleAt ? new Date(scheduleAt).toISOString() : undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        alert(json.error ?? `Save failed (${res.status})`);
        return;
      }
      setDraftBody("");
      setTopic("");
      setScheduleAt("");
      router.refresh();
      setTab("scheduled");
    } finally {
      setSaving(false);
    }
  }

  async function planCalendar() {
    setPlanning(true);
    try {
      const res = await fetch("/api/posts/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, weeks, postsPerWeek, startDate }),
      });
      const json = (await res.json()) as { items?: CalendarItem[]; error?: string };
      if (!res.ok || !json.items) {
        alert(json.error ?? `Plan failed (${res.status})`);
        return;
      }
      setCalendarItems(json.items);
    } finally {
      setPlanning(false);
    }
  }

  async function draftCalendarItem(i: number) {
    const item = calendarItems[i];
    if (!item) return;
    setCalendarItems((prev) => prev.map((c, idx) => (idx === i ? { ...c, drafting: true } : c)));
    try {
      const res = await fetch("/api/posts/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, topic: item.topic, characterName: item.characterName }),
      });
      const json = (await res.json()) as { body?: string };
      setCalendarItems((prev) =>
        prev.map((c, idx) => (idx === i ? { ...c, body: json.body, drafting: false } : c)),
      );
    } catch {
      setCalendarItems((prev) => prev.map((c, idx) => (idx === i ? { ...c, drafting: false } : c)));
    }
  }

  async function scheduleCalendarItem(i: number) {
    const item = calendarItems[i];
    if (!item?.body) return;
    await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        body: item.body,
        scheduledFor: new Date(`${item.date}T15:00:00`).toISOString(),
        aiMeta: { topic: item.topic, characterName: item.characterName },
      }),
    });
    setCalendarItems((prev) => prev.filter((_, idx) => idx !== i));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Post Scheduler</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Schedule organic posts, draft them with AI by post type, and generate a 2- or 4-week
            calendar you can schedule in bulk.
          </p>
        </CardHeader>
        <CardBody>
          {!hasBrandVoice ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              No brand-voice profile yet. <a href="/business" className="underline">Set one up</a> for
              dramatically better drafts.
            </div>
          ) : (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              Brand storytelling profile is active. Rosie will use it in every draft for {tenantName}.
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex gap-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1 w-fit">
        <TabBtn active={tab === "compose"} onClick={() => setTab("compose")}>
          <PencilLine className="h-3.5 w-3.5" /> Compose
        </TabBtn>
        <TabBtn active={tab === "calendar"} onClick={() => setTab("calendar")}>
          <CalendarDays className="h-3.5 w-3.5" /> Calendar
        </TabBtn>
        <TabBtn active={tab === "scheduled"} onClick={() => setTab("scheduled")}>
          <Save className="h-3.5 w-3.5" /> Scheduled ({scheduled.length})
        </TabBtn>
      </div>

      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPlatform(p.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition",
              platform === p.key
                ? "border-rosie-600 bg-rosie-50 text-rosie-700 dark:bg-rosie-950 dark:text-rosie-200"
                : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {tab === "compose" ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Compose a Post</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_240px]">
              <Field
                label="Topic / angle (optional)"
                value={topic}
                onChange={setTopic}
                placeholder="dusty boots after the Tucson summer pickup route"
              />
              <div>
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Feature character
                </span>
                <select
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
                >
                  <option value="">— none —</option>
                  {characters.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={draft} disabled={drafting} variant="outline">
                <Sparkles className="h-4 w-4" />
                {drafting ? "Drafting…" : "Draft with Rosie"}
              </Button>
            </div>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Post body
              </span>
              <textarea
                rows={10}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                placeholder="Draft a post with Rosie, or write one yourself…"
                className="w-full resize-y rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
              />
              <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                {draftBody.length} chars
              </div>
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
              />
              <Button onClick={() => save({ schedule: false })} disabled={saving} variant="outline">
                Save draft
              </Button>
              <Button onClick={() => save({ schedule: true })} disabled={saving || !scheduleAt}>
                {saving ? "Saving…" : "Schedule"}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {tab === "calendar" ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Generate Calendar</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SelectField
                label="Weeks"
                value={String(weeks)}
                onChange={(v) => setWeeks(Number(v) as 2 | 4)}
                options={[
                  { value: "2", label: "2 weeks" },
                  { value: "4", label: "4 weeks" },
                ]}
              />
              <NumberField
                label="Posts / week"
                value={postsPerWeek}
                onChange={(v) => setPostsPerWeek(v)}
                min={1}
                max={7}
              />
              <Field label="Starts" value={startDate} onChange={setStartDate} placeholder="YYYY-MM-DD" />
              <div className="flex items-end">
                <Button onClick={planCalendar} disabled={planning} className="w-full">
                  <CalendarDays className="h-4 w-4" />
                  {planning ? "Planning…" : "Plan calendar"}
                </Button>
              </div>
            </div>

            {calendarItems.length === 0 ? (
              <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                Generate a plan to see topic suggestions, then draft and schedule each item.
              </div>
            ) : (
              <ul className="space-y-2">
                {calendarItems.map((item, i) => (
                  <li
                    key={`${item.date}-${i}`}
                    className="rounded-md border border-[hsl(var(--border))] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
                          {item.date}
                          {item.characterName ? ` · ${item.characterName}` : ""}
                        </div>
                        <div className="font-semibold">{item.topic}</div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => draftCalendarItem(i)}
                          disabled={item.drafting}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {item.drafting ? "…" : item.body ? "Redraft" : "Draft"}
                        </Button>
                        <Button
                          size="sm"
                          disabled={!item.body}
                          onClick={() => scheduleCalendarItem(i)}
                        >
                          Schedule
                        </Button>
                      </div>
                    </div>
                    {item.body ? (
                      <textarea
                        rows={4}
                        value={item.body}
                        onChange={(e) =>
                          setCalendarItems((prev) =>
                            prev.map((c, idx) =>
                              idx === i ? { ...c, body: e.target.value } : c,
                            ),
                          )
                        }
                        className="mt-2 w-full resize-y rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-xs"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}

      {tab === "scheduled" ? (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Drafts &amp; Scheduled</h3>
          </CardHeader>
          <CardBody>
            {scheduled.length === 0 ? (
              <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                Nothing scheduled yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {scheduled.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-md border border-[hsl(var(--border))] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                        {p.platform} · {p.status}
                      </div>
                      {p.scheduledFor ? (
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {new Date(p.scheduledFor).toLocaleString()}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm whitespace-pre-wrap">{p.body}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function TabBtn({
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
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "bg-rosie-600 text-white"
          : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
      )}
    >
      {children}
    </button>
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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
      />
    </label>
  );
}
