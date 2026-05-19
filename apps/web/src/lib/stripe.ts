import Stripe from "stripe";

let _client: Stripe | null = null;

export function stripe(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is required");
  _client = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  return _client;
}

export const PRICE_IDS = {
  base: process.env.STRIPE_PRICE_BASE ?? "",
  llmOverage: process.env.STRIPE_PRICE_LLM_OVERAGE ?? "",
  smsOverage: process.env.STRIPE_PRICE_SMS_OVERAGE ?? "",
  imageOverage: process.env.STRIPE_PRICE_IMAGE_OVERAGE ?? "",
} as const;

export function priceIdForMeter(kind: "llm" | "sms" | "image"): string | null {
  switch (kind) {
    case "llm":
      return PRICE_IDS.llmOverage || null;
    case "sms":
      return PRICE_IDS.smsOverage || null;
    case "image":
      return PRICE_IDS.imageOverage || null;
  }
}
