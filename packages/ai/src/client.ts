import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
  _client = new Anthropic({ apiKey });
  return _client;
}

/** Models supported by the AI router today. Strategy work defaults to Opus 4.7. */
export const MODELS = {
  strategy: "claude-opus-4-7",
  draft: "claude-sonnet-4-6",
  cheap: "claude-haiku-4-5-20251001",
} as const;
