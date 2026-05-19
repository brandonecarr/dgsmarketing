import { NextResponse } from "next/server";
import { z } from "zod";
import { generateImage, IMAGE_MODEL, type ImageFormat } from "@rosie/ai";
import { db, creatives } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { uploadPublic } from "@/lib/supabase/admin";
import { checkBudget, recordUsage } from "@/lib/usage";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const Body = z.object({
  name: z.string().max(120).optional(),
  visualDirection: z.string().min(10).max(4000),
  style: z.string().max(200).optional(),
  tone: z.string().max(120).optional(),
  imageType: z.string().max(120).optional(),
  format: z.enum(["square", "wide", "story"]).default("wide"),
  exactAdText: z
    .object({
      headline: z.string().max(120).optional(),
      body: z.string().max(200).optional(),
      ctaPrimary: z.string().max(60).optional(),
      ctaSecondary: z.string().max(60).optional(),
      finePrint: z.string().max(200).optional(),
    })
    .optional(),
});

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  const rl = await checkRateLimit({
    tier: "ai_generation",
    identifier: `img:${session.tenant.id}`,
  });
  if (!rl.ok) return rateLimitResponse(rl);

  const verdict = await checkBudget({
    tenantId: session.tenant.id,
    kind: "image",
    units: 1,
    costUsd: Number(process.env.ROSIE_IMAGE_UNIT_COST_USD ?? 0.04),
  });
  if (!verdict.allowed) {
    return NextResponse.json({ error: verdict.reason }, { status: 402 });
  }

  let result;
  try {
    result = await generateImage(
      {
        visualDirection: input.visualDirection,
        style: input.style,
        tone: input.tone,
        imageType: input.imageType,
        exactAdText: input.exactAdText,
        brand: {
          name: session.tenant.name,
          category: session.profile?.category ?? undefined,
          city: session.profile?.address?.city ?? undefined,
          services: session.profile?.services ?? undefined,
        },
      },
      input.format as ImageFormat,
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "image generation failed" },
      { status: 502 },
    );
  }

  const buffer = Buffer.from(result.base64, "base64");
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const storagePath = `${session.tenant.id}/${fileName}`;

  let uploaded: { path: string; publicUrl: string } | null = null;
  try {
    uploaded = await uploadPublic("creatives", storagePath, buffer, "image/png");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "storage upload failed" },
      { status: 500 },
    );
  }

  const [row] = await db
    .insert(creatives)
    .values({
      tenantId: session.tenant.id,
      createdByUserId: session.user.id,
      kind: "image",
      format: input.format,
      name: input.name ?? null,
      provider: `openai:${IMAGE_MODEL}`,
      model: result.model,
      prompt: result.prompt,
      inputs: {
        visualDirection: input.visualDirection,
        style: input.style,
        tone: input.tone,
        imageType: input.imageType,
        exactAdText: input.exactAdText,
      },
      storagePath: uploaded.path,
      url: uploaded.publicUrl,
    })
    .returning();

  await recordUsage({
    tenantId: session.tenant.id,
    kind: "image_generated",
    units: 1,
    costUsd: Number(process.env.ROSIE_IMAGE_UNIT_COST_USD ?? 0.04),
    model: result.model,
    source: "image_creator",
    meta: { format: input.format },
  });

  return NextResponse.json({ ok: true, creative: row });
}
