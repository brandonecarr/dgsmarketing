import { NextResponse } from "next/server";
import { z } from "zod";
import { streamRosie } from "@rosie/ai";
import { loadActiveSession } from "@/lib/active-tenant";
import { checkBudget, recordLlmUsage } from "@/lib/usage";

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const verdict = await checkBudget({ tenantId: session.tenant.id, kind: "llm" });
  if (!verdict.allowed) {
    return NextResponse.json({ error: verdict.reason }, { status: 402 });
  }

  const ctx = {
    tenantName: session.tenant.name,
    category: session.profile?.category ?? undefined,
    city: session.profile?.address?.city ?? undefined,
    services: session.profile?.services ?? undefined,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamRosie({ context: ctx, messages: parsed.data.messages })) {
          if (chunk.type === "text" && chunk.delta) {
            controller.enqueue(encoder.encode(chunk.delta));
          } else if (chunk.type === "done" && chunk.usage) {
            await recordLlmUsage(
              session.tenant.id,
              chunk.usage.model,
              chunk.usage.inputTokens,
              chunk.usage.outputTokens,
              "rosie_chat",
              {
                cacheReadTokens: chunk.usage.cacheReadTokens,
                cacheCreationTokens: chunk.usage.cacheCreationTokens,
              },
            );
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `\n\n[Rosie error: ${err instanceof Error ? err.message : "unknown"}]`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
