import { anthropic, MODELS } from "./client";
import type { RosieContext } from "./types";

export interface ExplainActionInput {
  context: RosieContext;
  /** The rule + numbers the action was emitted from. */
  signal: {
    rule: string;
    inputs?: Record<string, unknown>;
    relatedEntity?: { type: string; id: string } | null;
  };
  /** The draft action so Rosie can rewrite "body" in her voice. */
  draft: { title: string; body: string };
}

export interface ExplainActionOutput {
  body: string;
  /** One-sentence "why this matters now". */
  why: string;
  usage?: { model: string; inputTokens: number; outputTokens: number };
}

/**
 * Rewrites a rule-generated Action Plan item in Rosie's voice with context-aware
 * reasoning. Falls back to the draft body if the model returns nothing usable.
 */
export async function explainAction(input: ExplainActionInput): Promise<ExplainActionOutput> {
  const client = anthropic();
  const system = [
    "You write Action Plan items for Rosie, an AI marketing operator for local service businesses.",
    "Tone: warm, direct, one paragraph max. No corporate buzzwords. No padding.",
    "End with a single concrete next step.",
    "",
    `Business: ${input.context.tenantName}${input.context.category ? ` · ${input.context.category}` : ""}${input.context.city ? ` · ${input.context.city}` : ""}`,
  ].join("\n");

  const user = [
    `Rule: ${input.signal.rule}`,
    input.signal.inputs ? `Inputs: ${JSON.stringify(input.signal.inputs)}` : "",
    `Draft title: ${input.draft.title}`,
    `Draft body: ${input.draft.body}`,
    "",
    'Respond ONLY with JSON: {"body": "rewritten body, 1 paragraph", "why": "one sentence on why now"}.',
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await client.messages.create({
      model: MODELS.draft,
      max_tokens: 350,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    let text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced?.[1]) text = fenced[1].trim();
    const parsed = JSON.parse(text) as { body?: unknown; why?: unknown };
    const body = typeof parsed.body === "string" && parsed.body.trim().length > 0 ? parsed.body.trim() : input.draft.body;
    const why = typeof parsed.why === "string" ? parsed.why.trim() : "";
    return {
      body,
      why,
      usage: {
        model: res.model,
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      },
    };
  } catch {
    return { body: input.draft.body, why: "" };
  }
}
