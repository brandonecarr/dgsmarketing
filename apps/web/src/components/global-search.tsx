"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@rosie/ui";

interface SearchResults {
  leads: Array<{ id: string; name: string | null; phone: string | null; email: string | null; stage: string }>;
  threads: Array<{ id: string; participantName: string | null; participantPhone: string | null; preview: string | null; lastAt: string | null }>;
  messages: Array<{ id: string; conversationId: string; direction: string; snippet: string; createdAt: string }>;
  posts: Array<{ id: string; platform: string; status: string; body: string; createdAt: string }>;
}

const EMPTY: SearchResults = { leads: [], threads: [], messages: [], posts: [] };

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults(EMPTY);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const j = await res.json();
        setResults(j.results ?? EMPTY);
      } catch (e) {
        console.error("search failed", e);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
      >
        <Search className="h-3.5 w-3.5" />
        Search
        <kbd className="ml-1 rounded border border-[hsl(var(--border))] px-1 text-[10px]">⌘K</kbd>
      </button>
    );
  }

  const total =
    results.leads.length + results.threads.length + results.messages.length + results.posts.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="mx-auto mt-24 w-full max-w-2xl rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
          <Search className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search leads, conversations, posts…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <button
            onClick={() => setOpen(false)}
            className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {q.length < 2 ? (
            <div className="px-4 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              Type at least 2 characters to search.
            </div>
          ) : loading && total === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              Searching…
            </div>
          ) : total === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
              No matches. Try different keywords.
            </div>
          ) : (
            <div className="divide-y divide-[hsl(var(--border))]">
              {results.leads.length > 0 ? (
                <Section title="Leads">
                  {results.leads.map((l) => (
                    <Row
                      key={l.id}
                      onClick={() => go(`/inbox`)}
                      heading={l.name ?? l.phone ?? l.email ?? "Lead"}
                      subtitle={`${l.phone ?? l.email ?? ""} · ${l.stage}`}
                    />
                  ))}
                </Section>
              ) : null}
              {results.threads.length > 0 ? (
                <Section title="Conversations">
                  {results.threads.map((t) => (
                    <Row
                      key={t.id}
                      onClick={() => go(`/inbox?thread=${t.id}`)}
                      heading={t.participantName ?? t.participantPhone ?? "Conversation"}
                      subtitle={t.preview ?? ""}
                    />
                  ))}
                </Section>
              ) : null}
              {results.messages.length > 0 ? (
                <Section title="Messages">
                  {results.messages.map((m) => (
                    <Row
                      key={m.id}
                      onClick={() => go(`/inbox?thread=${m.conversationId}`)}
                      heading={
                        <span
                          dangerouslySetInnerHTML={{ __html: m.snippet || "(match)" }}
                          className="prose prose-sm"
                        />
                      }
                      subtitle={`${m.direction} · ${new Date(m.createdAt).toLocaleString()}`}
                    />
                  ))}
                </Section>
              ) : null}
              {results.posts.length > 0 ? (
                <Section title="Posts">
                  {results.posts.map((p) => (
                    <Row
                      key={p.id}
                      onClick={() => go(`/posts`)}
                      heading={p.body.slice(0, 80)}
                      subtitle={`${p.platform} · ${p.status}`}
                    />
                  ))}
                </Section>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {title}
      </div>
      <ul>{children}</ul>
    </div>
  );
}

function Row({
  heading,
  subtitle,
  onClick,
}: {
  heading: React.ReactNode;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "block w-full px-4 py-2 text-left transition hover:bg-[hsl(var(--muted))]",
        )}
      >
        <div className="truncate text-sm font-medium">{heading}</div>
        {subtitle ? (
          <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">{subtitle}</div>
        ) : null}
      </button>
    </li>
  );
}
