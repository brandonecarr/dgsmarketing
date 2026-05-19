import { anthropic, MODELS } from "./client";
import type { ChatMessage, RosieContext, StreamChunk } from "./types";

/**
 * Rosie's personality. Cached on every request so the second turn pays
 * a tiny fraction of the input-token cost.
 */
function systemPrompt(ctx: RosieContext): string {
  const lines: string[] = [
    "You are Rosie, an always-on AI marketing operator for local service businesses.",
    "",
    "Voice:",
    "- Warm, direct, and confident. Like a sharp teammate who's been on the job five years.",
    "- Plain language. No corporate buzzwords. No 'leverage', no 'synergy', no 'unlock'.",
    "- Be specific. Cite numbers when you have them. If you don't, ask.",
    "- Recommend the next concrete action, not a list of options.",
    "",
    "What you do:",
    "- Read the gauges (Paid Ads, Organic, Website, KPIs) and surface what's slipping.",
    "- Draft ads, posts, replies, and follow-ups in the business's brand voice.",
    "- Suggest pipeline moves: who to nudge, which campaigns to pause, what to test next.",
    "- Explain *why* in one sentence, not a paragraph.",
    "",
    "Hard rules:",
    "- Never fabricate metrics. If you don't have a number, say so.",
    "- Never recommend illegal, deceptive, or platform-policy-violating tactics.",
    "- Keep responses tight. One paragraph is usually enough.",
  ];

  lines.push("", "Business context:");
  lines.push(`- Tenant: ${ctx.tenantName}`);
  if (ctx.category) lines.push(`- Category: ${ctx.category}`);
  if (ctx.city) lines.push(`- Location: ${ctx.city}`);
  if (ctx.services?.length) lines.push(`- Services: ${ctx.services.join(", ")}`);
  if (ctx.performanceSnapshot) {
    lines.push("", "Current performance snapshot:", ctx.performanceSnapshot);
  }

  return lines.join("\n");
}

export interface RosieStreamOptions {
  context: RosieContext;
  messages: ChatMessage[];
  /** Override the default strategy model. */
  model?: string;
  /** Anthropic max output tokens. */
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * Streams Rosie's response as an async iterable of StreamChunks.
 * Uses Anthropic prompt caching on the system prompt so steady-state cost
 * is just the new turn's input.
 */
export async function* streamRosie(opts: RosieStreamOptions): AsyncGenerator<StreamChunk> {
  const client = anthropic();
  const model = opts.model ?? MODELS.strategy;

  const stream = client.messages.stream(
    {
      model,
      max_tokens: opts.maxTokens ?? 1024,
      system: [
        {
          type: "text",
          text: systemPrompt(opts.context),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: opts.messages.flatMap((m) =>
        m.role === "system"
          ? []
          : [{ role: m.role as "user" | "assistant", content: m.content }],
      ),
    },
    { signal: opts.signal },
  );

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "text", delta: event.delta.text };
    }
  }

  const final = await stream.finalMessage();
  yield {
    type: "done",
    usage: {
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      cacheCreationTokens: final.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
      model: final.model,
    },
  };
}
