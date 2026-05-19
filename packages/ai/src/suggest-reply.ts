import { anthropic, MODELS } from "./client";
import type { RosieContext } from "./types";

export interface ConversationTurn {
  direction: "inbound" | "outbound";
  body: string;
}

export interface SuggestReplyInput {
  context: RosieContext;
  /** Last ~20 turns of the conversation, oldest → newest. */
  history: ConversationTurn[];
  /** Lead metadata Rosie should weave in if relevant (zip, service, etc.). */
  leadMeta?: Record<string, unknown>;
  /** Optional operator hint: "thank them but defer to tomorrow" etc. */
  instruction?: string;
}

export interface SuggestReplyOutput {
  reply: string;
  reasoning: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    model: string;
  };
}

function systemPromptForReply(ctx: RosieContext): string {
  const lines = [
    "You are Rosie, replying to an inbound SMS on behalf of a local service business.",
    "",
    "Write the reply directly — no preamble like 'Sure, here is your reply:'.",
    "Tone: warm, direct, conversational. Like a real teammate texting back.",
    "Length: 1–3 sentences max for SMS. Never write more than 320 characters.",
    "If you need information (zip, dog count, frequency), ask one specific question.",
    "Never invent prices, addresses, or hours.",
    "End with one clear next step (question, ask for info, or confirmation).",
    "",
    `Business: ${ctx.tenantName}`,
  ];
  if (ctx.category) lines.push(`Category: ${ctx.category}`);
  if (ctx.city) lines.push(`City: ${ctx.city}`);
  if (ctx.services?.length) lines.push(`Services: ${ctx.services.join(", ")}`);
  return lines.join("\n");
}

function buildUserMessage(input: SuggestReplyInput): string {
  const parts: string[] = [];
  if (input.leadMeta && Object.keys(input.leadMeta).length > 0) {
    parts.push("Lead info:");
    parts.push(JSON.stringify(input.leadMeta, null, 2));
  }
  parts.push("Conversation so far (oldest → newest):");
  for (const turn of input.history) {
    parts.push(`${turn.direction === "inbound" ? "LEAD" : "US"}: ${turn.body}`);
  }
  if (input.instruction) {
    parts.push("");
    parts.push(`Operator instruction: ${input.instruction}`);
  }
  parts.push("");
  parts.push(
    'Draft the next outbound reply. Respond ONLY with JSON: {"reply": "...", "reasoning": "one short sentence on why this is the right move"}.',
  );
  return parts.join("\n");
}

export async function suggestReply(input: SuggestReplyInput): Promise<SuggestReplyOutput> {
  const client = anthropic();
  const res = await client.messages.create({
    model: MODELS.draft,
    max_tokens: 400,
    system: [
      {
        type: "text",
        text: systemPromptForReply(input.context),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });

  const text =
    res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("") || "";

  let reply = text.trim();
  let reasoning = "";
  // Strip code fences if Claude wrapped JSON in ```json ... ```.
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) reply = fenced[1].trim();
  try {
    const parsed = JSON.parse(reply) as { reply?: unknown; reasoning?: unknown };
    if (typeof parsed.reply === "string") reply = parsed.reply.trim();
    if (typeof parsed.reasoning === "string") reasoning = parsed.reasoning;
  } catch {
    // Fall back to raw text if the model didn't comply.
  }

  return {
    reply,
    reasoning,
    usage: {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      cacheCreationTokens: res.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
      model: res.model,
    },
  };
}
