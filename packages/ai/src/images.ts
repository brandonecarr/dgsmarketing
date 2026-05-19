import OpenAI from "openai";

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");
  _openai = new OpenAI({ apiKey });
  return _openai;
}

export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";

export type ImageFormat = "square" | "wide" | "story";

export interface ImageInputs {
  visualDirection: string;
  style?: string;
  tone?: string;
  imageType?: string;
  exactAdText?: {
    headline?: string;
    body?: string;
    ctaPrimary?: string;
    ctaSecondary?: string;
    finePrint?: string;
  };
  brand?: {
    name: string;
    category?: string;
    city?: string;
    services?: string[];
  };
}

const FORMAT_SIZE: Record<ImageFormat, "1024x1024" | "1792x1024" | "1024x1792"> = {
  square: "1024x1024",
  wide: "1792x1024",
  story: "1024x1792",
};

export function buildImagePrompt(inputs: ImageInputs): string {
  const lines: string[] = [];
  lines.push(inputs.visualDirection);
  if (inputs.style) lines.push(`Style: ${inputs.style}.`);
  if (inputs.tone) lines.push(`Tone: ${inputs.tone}.`);
  if (inputs.imageType) lines.push(`Image type: ${inputs.imageType}.`);

  const ad = inputs.exactAdText;
  if (ad && Object.values(ad).some(Boolean)) {
    lines.push("");
    lines.push("Include the following EXACT text overlaid as ad copy. Spell every word correctly:");
    if (ad.headline) lines.push(`- Headline (large): "${ad.headline}"`);
    if (ad.body) lines.push(`- Body (medium): "${ad.body}"`);
    if (ad.ctaPrimary) lines.push(`- Primary CTA badge: "${ad.ctaPrimary}"`);
    if (ad.ctaSecondary) lines.push(`- Secondary CTA: "${ad.ctaSecondary}"`);
    if (ad.finePrint) lines.push(`- Fine print (small): "${ad.finePrint}"`);
  }

  if (inputs.brand) {
    lines.push("");
    lines.push(
      `Business context: ${inputs.brand.name}${inputs.brand.category ? `, a ${inputs.brand.category}` : ""}${inputs.brand.city ? ` in ${inputs.brand.city}` : ""}.`,
    );
    if (inputs.brand.services?.length) {
      lines.push(`Services: ${inputs.brand.services.join(", ")}.`);
    }
  }

  lines.push("");
  lines.push(
    "Composition rules: ad-quality lighting, clear focal point, clean negative space for the headline, all text crisp and legible.",
  );
  return lines.join("\n");
}

export interface GenerateImageResult {
  /** base64 PNG content. */
  base64: string;
  prompt: string;
  model: string;
  format: ImageFormat;
}

export async function generateImage(
  inputs: ImageInputs,
  format: ImageFormat = "wide",
): Promise<GenerateImageResult> {
  const client = openai();
  const prompt = buildImagePrompt(inputs);
  const res = await client.images.generate({
    model: IMAGE_MODEL,
    prompt,
    size: FORMAT_SIZE[format],
    n: 1,
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image generation returned no data");
  return { base64: b64, prompt, model: IMAGE_MODEL, format };
}
