"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles, RefreshCw } from "lucide-react";
import { Card, CardBody, CardHeader, cn } from "@rosie/ui";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const STAGES = [
  "new",
  "engaged",
  "quoted",
  "qualified",
  "booked",
  "won",
  "lost",
] as const;
type Stage = (typeof STAGES)[number];

const STAGE_COLOR: Record<Stage, string> = {
  new: "bg-blue-500",
  engaged: "bg-emerald-500",
  quoted: "bg-amber-500",
  qualified: "bg-violet-500",
  booked: "bg-cyan-500",
  won: "bg-emerald-600",
  lost: "bg-red-500",
};

const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  engaged: "Engaged",
  quoted: "Quoted",
  qualified: "Qualified",
  booked: "Booked",
  won: "Won",
  lost: "Lost",
};

interface ConversationRow {
  id: string;
  participantPhone: string | null;
  participantName: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  provider: string;
  leadId: string | null;
  stage: Stage | null;
  score: number | null;
}

interface MessageRow {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  createdAt: string;
  recordingUrl?: string | null;
  language?: string | null;
  translatedBody?: string | null;
  translatedTo?: string | null;
}

interface Props {
  tenantId: string;
  userId: string;
  userName: string;
  conversations: ConversationRow[];
  stageCounts: Array<{ stage: Stage; count: number }>;
  stats: { total: number; active: number; won: number; closeRate: number };
  activeConversationId: string | null;
  activeMessages: MessageRow[];
  tenantLocale: string;
}

export function InboxView({
  tenantId,
  userId,
  userName,
  conversations: initialConvs,
  stageCounts,
  stats,
  activeConversationId,
  activeMessages: initialMessages,
  tenantLocale,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [otherViewers, setOtherViewers] = useState<Array<{ userId: string; userName: string }>>([]);

  const [conversations, setConversations] = useState(initialConvs);
  const [messages, setMessages] = useState(initialMessages);
  const [activeId, setActiveId] = useState<string | null>(activeConversationId);
  const [reply, setReply] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [suggestionMeta, setSuggestionMeta] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Realtime: subscribe to new messages + conversation bumps for this tenant.
  useEffect(() => {
    const sb = getSupabaseBrowser();
    const channel = sb
      .channel(`inbox-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `tenant_id=eq.${tenantId}` },
        () => {
          startTransition(() => router.refresh());
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `tenant_id=eq.${tenantId}` },
        () => {
          startTransition(() => router.refresh());
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads", filter: `tenant_id=eq.${tenantId}` },
        () => {
          startTransition(() => router.refresh());
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [tenantId, router]);

  // Presence: who else (in this tenant) is looking at this thread right now.
  useEffect(() => {
    if (!activeId) {
      setOtherViewers([]);
      return;
    }
    const sb = getSupabaseBrowser();
    const channel = sb.channel(`thread-presence:${activeId}`, {
      config: { presence: { key: userId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, Array<{ userName: string }>>;
        const others: Array<{ userId: string; userName: string }> = [];
        for (const [uid, metas] of Object.entries(state)) {
          if (uid === userId) continue;
          const last = metas[metas.length - 1];
          if (last) others.push({ userId: uid, userName: last.userName });
        }
        setOtherViewers(others);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ userName });
      });
    return () => {
      sb.removeChannel(channel);
    };
  }, [activeId, userId, userName]);

  // Sync from props when server refreshes.
  useEffect(() => {
    setConversations(initialConvs);
  }, [initialConvs]);
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);
  useEffect(() => {
    setActiveId(activeConversationId);
  }, [activeConversationId]);

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  function selectThread(id: string) {
    setActiveId(id);
    setReply("");
    setSuggestionMeta(null);
    router.replace(`/inbox?thread=${id}`);
  }

  async function send() {
    if (!activeId || !reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${activeId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim(), dryRun: true }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? `Send failed (${res.status})`);
        return;
      }
      setReply("");
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  async function suggest() {
    if (!activeId || suggesting) return;
    setSuggesting(true);
    setSuggestionMeta(null);
    try {
      const res = await fetch("/api/rosie/suggest-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId }),
      });
      const json = (await res.json()) as { reply?: string; reasoning?: string; error?: string };
      if (json.error) {
        alert(json.error);
        return;
      }
      if (json.reply) {
        setReply(json.reply);
        if (json.reasoning) setSuggestionMeta(json.reasoning);
      }
    } finally {
      setSuggesting(false);
    }
  }

  async function changeStage(stage: Stage) {
    if (!activeConv?.leadId) return;
    await fetch(`/api/leads/${activeConv.leadId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    router.refresh();
  }

  const maxStageCount = Math.max(1, ...stageCounts.map((s) => s.count));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatCard label="Total Leads" value={stats.total} />
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Close Rate" value={`${stats.closeRate}%`} />
        <StatCard label="Won" value={stats.won} />
      </div>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-rosie-700">Pipeline</div>
        </CardHeader>
        <CardBody className="space-y-1.5">
          {stageCounts.map((s) => (
            <div key={s.stage} className="flex items-center gap-2">
              <div
                className={cn(
                  "h-7 rounded-md text-xs font-semibold text-white px-3 flex items-center",
                  STAGE_COLOR[s.stage],
                )}
                style={{ width: `${Math.max(8, (s.count / maxStageCount) * 100)}%` }}
              >
                {STAGE_LABEL[s.stage]} ({s.count})
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Conversations</div>
              <button
                onClick={() => router.refresh()}
                className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                aria-label="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {conversations.length === 0 ? (
              <InboxEmptyState />
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => selectThread(c.id)}
                      className={cn(
                        "block w-full border-b border-[hsl(var(--border))] px-4 py-3 text-left transition",
                        activeId === c.id
                          ? "bg-rosie-50 dark:bg-rosie-950"
                          : "hover:bg-[hsl(var(--muted))]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="truncate text-sm font-semibold">
                            {c.participantName ?? c.participantPhone ?? "Unknown"}
                          </div>
                          {c.score !== null ? <ScorePill score={c.score} /> : null}
                        </div>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {c.lastMessageAt
                            ? new Date(c.lastMessageAt).toLocaleDateString()
                            : ""}
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex h-1.5 w-1.5 rounded-full",
                            c.stage ? STAGE_COLOR[c.stage] : "bg-neutral-400",
                          )}
                        />
                        <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                          {c.stage ? STAGE_LABEL[c.stage] : "—"} · {c.provider}
                        </span>
                        {c.unreadCount > 0 ? (
                          <span className="ml-auto rounded-full bg-rosie-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                            {c.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      {c.lastMessagePreview ? (
                        <p className="mt-1 line-clamp-1 text-xs text-[hsl(var(--muted-foreground))]">
                          {c.lastMessagePreview}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card className="flex h-[60vh] flex-col">
          {activeConv ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold">
                        {activeConv.participantName ?? activeConv.participantPhone ?? "Unknown"}
                      </div>
                      {otherViewers.length > 0 ? (
                        <div className="flex items-center gap-1">
                          {otherViewers.slice(0, 3).map((v) => (
                            <span
                              key={v.userId}
                              title={`${v.userName} is also viewing`}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-[hsl(var(--background))] bg-emerald-500 text-[9px] font-bold text-white"
                            >
                              {v.userName.charAt(0).toUpperCase()}
                            </span>
                          ))}
                          {otherViewers.length > 3 ? (
                            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                              +{otherViewers.length - 3}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {activeConv.participantPhone} · {activeConv.provider}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {STAGES.map((s) => (
                      <button
                        key={s}
                        onClick={() => changeStage(s)}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
                          activeConv.stage === s
                            ? `${STAGE_COLOR[s]} text-white`
                            : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
                        )}
                      >
                        {STAGE_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 px-5 py-3">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
                    No messages in this thread yet.
                  </p>
                ) : (
                  messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      tenantLocale={tenantLocale}
                      onTranslated={(translated) =>
                        setMessages((rows) =>
                          rows.map((r) =>
                            r.id === m.id
                              ? { ...r, translatedBody: translated, translatedTo: tenantLocale }
                              : r,
                          ),
                        )
                      }
                    />
                  ))
                )}
              </div>
              <div className="border-t border-[hsl(var(--border))] p-3">
                {suggestionMeta ? (
                  <p className="mb-2 text-[10px] italic text-[hsl(var(--muted-foreground))]">
                    Rosie: {suggestionMeta}
                  </p>
                ) : null}
                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Reply…"
                    className="flex-1 resize-none rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
                  />
                  <button
                    onClick={suggest}
                    disabled={suggesting}
                    title="Rosie suggests a reply"
                    className="inline-flex h-9 items-center gap-1 rounded-md border border-[hsl(var(--border))] px-3 text-xs hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {suggesting ? "…" : "Suggest"}
                  </button>
                  <button
                    onClick={send}
                    disabled={sending || !reply.trim()}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-rosie-600 text-white disabled:opacity-50"
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                  Enter to send · Shift+Enter for newline
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
              Pick a conversation on the left.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardBody className="text-center">
        <div className="text-2xl font-bold">{value}</div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {label}
        </div>
      </CardBody>
    </Card>
  );
}

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 75
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
      : score >= 50
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none",
        tone,
      )}
      title={`Predictive lead score: ${score}/100`}
    >
      {score}
    </span>
  );
}

function MessageBubble({
  message,
  tenantLocale,
  onTranslated,
}: {
  message: MessageRow;
  tenantLocale: string;
  onTranslated: (translated: string) => void;
}) {
  const [translating, setTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const tenantPrimary = tenantLocale.split("-")[0]?.toLowerCase() ?? "en";
  const detectedPrimary = message.language?.split("-")[0]?.toLowerCase();
  const isForeign =
    !!detectedPrimary && detectedPrimary !== "und" && detectedPrimary !== tenantPrimary;
  const hasCached =
    !!message.translatedBody &&
    (message.translatedTo?.split("-")[0]?.toLowerCase() ?? "") === tenantPrimary;

  async function doTranslate() {
    if (translating) return;
    if (hasCached) {
      setShowTranslated((v) => !v);
      return;
    }
    setTranslating(true);
    try {
      const res = await fetch(`/api/messages/${message.id}/translate`, { method: "POST" });
      const j = await res.json();
      if (res.ok && typeof j.translatedBody === "string") {
        onTranslated(j.translatedBody);
        setShowTranslated(true);
      }
    } finally {
      setTranslating(false);
    }
  }

  const visibleBody = showTranslated && message.translatedBody ? message.translatedBody : message.body;

  return (
    <div
      className={cn(
        "max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed",
        message.direction === "outbound"
          ? "ml-auto bg-rosie-600 text-white"
          : "mr-auto bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]",
      )}
    >
      <div className="whitespace-pre-wrap">{visibleBody}</div>
      {message.recordingUrl ? (
        <audio
          controls
          preload="none"
          src={message.recordingUrl}
          className="mt-2 w-full max-w-xs"
        />
      ) : null}
      {isForeign && message.direction === "inbound" ? (
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-900 dark:text-amber-100">
            {message.language}
          </span>
          <button
            onClick={doTranslate}
            disabled={translating}
            className="text-[10px] font-semibold text-rosie-700 hover:underline disabled:opacity-50 dark:text-rosie-300"
          >
            {translating
              ? "Translating…"
              : showTranslated
                ? "Show original"
                : hasCached
                  ? `Show in ${tenantLocale}`
                  : `Translate → ${tenantLocale}`}
          </button>
        </div>
      ) : null}
      <div
        className={cn(
          "mt-1 text-[9px] uppercase tracking-wider",
          message.direction === "outbound" ? "text-white/70" : "text-[hsl(var(--muted-foreground))]",
        )}
      >
        {new Date(message.createdAt).toLocaleString()}
      </div>
    </div>
  );
}

function InboxEmptyState() {
  const [seeding, setSeeding] = useState(false);
  const router = useRouter();

  async function seed() {
    setSeeding(true);
    try {
      const res = await fetch("/api/onboarding/seed-sample", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Seeding failed");
        return;
      }
      router.refresh();
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="px-5 py-10 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-rosie-600" />
      <p className="mt-2 text-sm font-semibold">Your inbox is empty.</p>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
        Connect Quo or OpenPhone in Settings to receive real inbound SMS — or drop in sample
        conversations to take it for a spin first.
      </p>
      <button
        onClick={seed}
        disabled={seeding}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-rosie-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rosie-700 disabled:opacity-60"
      >
        {seeding ? "Seeding…" : "Add sample conversations"}
      </button>
      <p className="mt-3 text-[10px] text-[hsl(var(--muted-foreground))]">
        Sample data is tagged and easy to clear later.
      </p>
    </div>
  );
}
