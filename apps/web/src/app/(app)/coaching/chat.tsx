"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send } from "lucide-react";
import { Card, CardBody, CardHeader, cn } from "@rosie/ui";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function CoachingChat({ tenantName }: { tenantName: string }) {
  return (
    <Suspense fallback={null}>
      <Inner tenantName={tenantName} />
    </Suspense>
  );
}

function Inner({ tenantName }: { tenantName: string }) {
  const params = useSearchParams();
  const initialQ = params.get("q") ?? "";

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: `Coaching mode for ${tenantName}. I'll keep it strategic — fewer drafts, more frameworks. What's on your mind?`,
    },
  ]);
  const [input, setInput] = useState(initialQ);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }, { role: "assistant", content: "" }];
    setMessages(next);
    setStreaming(true);
    try {
      const res = await fetch("/api/rosie/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                "[Coaching mode] Be strategic and concise. Prefer frameworks, tradeoffs, and one concrete next step.",
            },
            ...next.slice(0, -1),
          ],
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = {
          role: "assistant",
          content: `Sorry — something broke: ${e instanceof Error ? e.message : "unknown"}.`,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }, [input, messages, streaming]);

  // Auto-fire when arriving with ?q=
  useEffect(() => {
    if (initialQ && messages.length === 1) {
      send();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold">Conversation</h3>
      </CardHeader>
      <CardBody>
        <div ref={scrollRef} className="mb-3 max-h-[55vh] space-y-3 overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl px-3 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "ml-8 bg-rosie-600 text-white"
                  : "mr-8 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]",
              )}
            >
              {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="What strategic question is on your mind?"
            className="flex-1 resize-none rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rosie-500"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-rosie-600 text-white disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </CardBody>
    </Card>
  );
}
