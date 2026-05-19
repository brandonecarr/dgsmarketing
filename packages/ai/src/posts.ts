import { anthropic, MODELS } from "./client";
import type { RosieContext } from "./types";

export interface BrandVoice {
  storytellingStrategy?: string;
  contentPersonality?: string;
  sellingStyle?: string;
  postLength?: string;
  guardrails?: string;
  recurringCharacters?: Array<{
    name: string;
    role: string;
    description: string;
    profile?: Record<string, unknown>;
  }>;
}

export type PostPlatform = "facebook" | "instagram" | "google_business" | "linkedin" | "tiktok";

function brandVoiceBlock(voice?: BrandVoice): string {
  if (!voice) return "No brand-voice profile set yet — use a warm, direct, plain-language voice.";
  const lines: string[] = [];
  if (voice.storytellingStrategy) lines.push(`Storytelling strategy:\n${voice.storytellingStrategy}`);
  if (voice.contentPersonality) lines.push(`Content personality: ${voice.contentPersonality}`);
  if (voice.sellingStyle) lines.push(`Selling style: ${voice.sellingStyle}`);
  if (voice.postLength) lines.push(`Post length: ${voice.postLength}`);
  if (voice.guardrails) lines.push(`Guardrails (do NOT do these):\n${voice.guardrails}`);
  if (voice.recurringCharacters?.length) {
    lines.push("Recurring characters:");
    for (const c of voice.recurringCharacters) {
      lines.push(`  - ${c.name} (${c.role}): ${c.description}`);
    }
  }
  return lines.join("\n");
}

function platformGuidance(platform: PostPlatform): string {
  switch (platform) {
    case "facebook":
      return "Facebook organic. 80–220 words is the sweet spot. No clickbait, no all-caps hooks, no #hashtag spam (max 2). One specific moment > a generic claim.";
    case "instagram":
      return "Instagram caption. 80–150 words. First line is the hook. Hashtags allowed (5–10) at the very end.";
    case "google_business":
      return "Google Business Profile update. 100–300 chars. Clear, local, scannable. Mention the city + service.";
    case "linkedin":
      return "LinkedIn. 80–180 words. Professional but human. One concrete number or observation.";
    case "tiktok":
      return "TikTok caption. <120 chars. Hook + payoff. 3–5 hashtags.";
  }
}

export interface DraftPostInput {
  context: RosieContext;
  voice?: BrandVoice;
  platform: PostPlatform;
  topic?: string;
  characterName?: string;
}

export interface DraftPostOutput {
  body: string;
  title?: string;
  usage?: { model: string; inputTokens: number; outputTokens: number };
}

export async function draftPost(input: DraftPostInput): Promise<DraftPostOutput> {
  const client = anthropic();
  const character =
    input.characterName && input.voice?.recurringCharacters?.find((c) => c.name === input.characterName);

  const system = [
    "You write organic social posts for a local service business in the voice of its operator team.",
    "Avoid corporate buzzwords, exaggerated claims, forced urgency, and aggressive CTAs.",
    "When the brand has recurring characters, name them and reference them by their role.",
    "Show the work in public: route notes, small wins, lessons, observations.",
    "End with a question, an invitation, or nothing — never a hard sell.",
    "",
    "Business context:",
    `- ${input.context.tenantName}${input.context.category ? ` · ${input.context.category}` : ""}${input.context.city ? ` · ${input.context.city}` : ""}`,
    input.context.services?.length ? `- Services: ${input.context.services.join(", ")}` : "",
    "",
    "Brand voice:",
    brandVoiceBlock(input.voice),
  ]
    .filter(Boolean)
    .join("\n");

  const userParts: string[] = [];
  userParts.push(`Platform: ${input.platform}`);
  userParts.push(platformGuidance(input.platform));
  if (input.topic) userParts.push(`Topic / angle: ${input.topic}`);
  if (character) userParts.push(`Feature ${character.name} (${character.role}): ${character.description}`);
  userParts.push("");
  userParts.push('Respond with ONLY JSON: {"body": "...", "title": "(optional headline)"}.');

  const res = await client.messages.create({
    model: MODELS.draft,
    max_tokens: 700,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userParts.join("\n") }],
  });

  const text =
    res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim() || "";

  let body = text;
  let title: string | undefined;
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) body = fenced[1].trim();
  try {
    const parsed = JSON.parse(body) as { body?: unknown; title?: unknown };
    if (typeof parsed.body === "string") body = parsed.body.trim();
    if (typeof parsed.title === "string") title = parsed.title.trim();
  } catch {
    /* fall back to raw text */
  }

  return {
    body,
    title,
    usage: {
      model: res.model,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    },
  };
}

export interface CalendarPlanItem {
  date: string; // YYYY-MM-DD
  topic: string;
  characterName?: string;
  body?: string;
}

/**
 * Plans an N-week organic calendar. Returns dates + topics with bodies left blank
 * (so the operator can refine before bulk-generating drafts).
 */
export async function planPostCalendar(opts: {
  context: RosieContext;
  voice?: BrandVoice;
  platform: PostPlatform;
  weeks: 2 | 4;
  postsPerWeek?: number;
  startDate?: string;
}): Promise<CalendarPlanItem[]> {
  const client = anthropic();
  const postsPerWeek = opts.postsPerWeek ?? 3;
  const start = opts.startDate ? new Date(opts.startDate) : new Date();
  const startIso = start.toISOString().slice(0, 10);

  const system = [
    "You are a content planner for a local service business. Produce a varied, durable calendar of ideas.",
    "Mix: operational story (how the work gets done), customer micro-story, lesson learned, seasonal observation, local landmark / neighborhood mention, behind-the-scenes, problem we fix that DIY can't.",
    "Never repeat the same angle twice in a row. Avoid promotional spam.",
    "",
    `Business: ${opts.context.tenantName}${opts.context.category ? ` · ${opts.context.category}` : ""}${opts.context.city ? ` · ${opts.context.city}` : ""}`,
    "",
    "Brand voice:",
    brandVoiceBlock(opts.voice),
  ].join("\n");

  const characters = opts.voice?.recurringCharacters?.map((c) => c.name).filter(Boolean) ?? [];

  const user = [
    `Plan ${opts.weeks} weeks (~${postsPerWeek * opts.weeks} posts) for ${opts.platform}, starting ${startIso}.`,
    characters.length ? `Recurring characters available: ${characters.join(", ")}.` : "",
    "Spread posts ~evenly across each week. Each item must have a unique angle.",
    "",
    'Respond ONLY with a JSON array of: {"date": "YYYY-MM-DD", "topic": "...", "characterName": "(optional)"}.',
  ]
    .filter(Boolean)
    .join("\n");

  const res = await client.messages.create({
    model: MODELS.draft,
    max_tokens: 2000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });

  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  let raw = text;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) raw = fenced[1].trim();

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const i = item as Record<string, unknown>;
        const date = typeof i.date === "string" ? i.date : null;
        const topic = typeof i.topic === "string" ? i.topic : null;
        if (!date || !topic) return null;
        return {
          date,
          topic,
          characterName: typeof i.characterName === "string" ? i.characterName : undefined,
        } as CalendarPlanItem;
      })
      .filter((x): x is CalendarPlanItem => x !== null);
  } catch {
    return [];
  }
}
