"use client";

import { Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@rosie/ui";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function RosieChat({
  open,
  onClose,
  tenantName,
}: {
  open: boolean;
  onClose: () => void;
  tenantName: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: `Hi — I'm Rosie. I keep an eye on ${tenantName}'s marketing and tell you what to fix first. Ask me anything: "What should I do this week?", "Draft a Facebook post about heat-season pickups", "Why is my close rate dropping?"`,
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const next: Msg[] = [...messages, { role: "user", content: text }, { role: "assistant", content: "" }];
    setMessages(next);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/rosie/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(0, -1) }),
        signal: controller.signal,
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
    } catch (err) {
      setMessages((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = {
          role: "assistant",
          content:
            err instanceof DOMException && err.name === "AbortError"
              ? "(stopped)"
              : `Sorry — something broke: ${err instanceof Error ? err.message : "unknown error"}.`,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, messages, streaming]);

  function clear() {
    abortRef.current?.abort();
    setMessages([
      {
        role: "assistant",
        content: `Fresh start. What's on your mind for ${tenantName}?`,
      },
    ]);
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl transition-transform",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <header className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-rosie-600 text-white text-xs">R</span>
            Rosie
          </div>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            Your AI marketing operator
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clear}
            title="Clear conversation"
            className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
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
        className="flex items-end gap-2 border-t border-[hsl(var(--border))] p-3"
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
          placeholder="Ask Rosie how to grow, scale, or fix something."
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
      <p className="px-3 pb-2 text-[10px] text-[hsl(var(--muted-foreground))]">
        Enter to send • Shift+Enter for newline
      </p>
    </aside>
  );
}
