import { anthropic, MODELS } from "./client";

/**
 * Detect the BCP-47 language of a message and (optionally) translate it.
 *
 * We use Claude Haiku because it's fast + cheap + handles 100+ languages
 * including informal SMS slang. A franc/cld3 approach would be free but
 * would miss obvious ambiguity ("ok thanks" reads as English to a stats
 * detector regardless of the real conversation language).
 */
export interface DetectAndTranslateResult {
  language: string;
  /** Present only when `targetLocale` was provided AND it differs from detected. */
  translatedBody?: string;
}

export async function detectLanguage(text: string): Promise<string> {
  const client = anthropic();
  const trimmed = text.trim().slice(0, 800);
  if (!trimmed) return "und";

  const res = await client.messages.create({
    model: MODELS.cheap,
    max_tokens: 8,
    system:
      "You are a language detector. Reply with ONLY a BCP-47 language code (lowercase, dashes), like 'en', 'es-MX', 'pt-BR', 'zh-CN', 'ar'. No punctuation, no explanation. If unsure or ambiguous, reply 'und'.",
    messages: [{ role: "user", content: trimmed }],
  });

  const out = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, "");
  return out.length > 0 ? out : "und";
}

export async function translate(
  text: string,
  targetLocale: string,
): Promise<string> {
  const client = anthropic();
  const trimmed = text.trim().slice(0, 4000);
  if (!trimmed) return "";

  const res = await client.messages.create({
    model: MODELS.cheap,
    max_tokens: 800,
    system: `You are a translator. Translate the user's message into ${targetLocale}.

Rules:
- Output ONLY the translation, no preface, no quotes, no notes.
- Preserve the tone (casual stays casual, formal stays formal).
- Keep proper nouns, phone numbers, links, and prices unchanged.
- If the input is already in ${targetLocale}, repeat it unchanged.`,
    messages: [{ role: "user", content: trimmed }],
  });

  return res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

/**
 * Same primary-language as a tenant locale "en-US" → "en". Use this to skip
 * translation when an inbound message is already in the operator's language.
 */
export function primaryLang(locale: string): string {
  return locale.split("-")[0]!.toLowerCase();
}
