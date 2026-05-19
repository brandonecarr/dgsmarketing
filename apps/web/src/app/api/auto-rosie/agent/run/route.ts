import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { runAgent, type AgentToolInvocation } from "@rosie/ai";
import { db, autoRosieRuns, businessProfile, tenants } from "@rosie/db";
import { eq } from "@rosie/db";
import { AGENT_TOOLS } from "@/lib/auto-rosie/agent/tools";
import { dispatchTool } from "@/lib/auto-rosie/agent/dispatch";
import { loadActiveSession } from "@/lib/active-tenant";
import { checkBudget, recordLlmUsage } from "@/lib/usage";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const Body = z.object({
  task: z.string().min(2).max(2000).optional(),
  maxSteps: z.number().int().min(1).max(15).optional(),
});

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

async function authorize(req: Request): Promise<{ tenantId: string; userId: string }> {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    const body = (await req.clone().json().catch(() => ({}))) as {
      tenantId?: string;
      userId?: string;
    };
    if (!body.tenantId || !body.userId)
      throw new Error("cron run requires tenantId and userId in body");
    return { tenantId: body.tenantId, userId: body.userId };
  }
  const session = await loadActiveSession();
  return { tenantId: session.tenant.id, userId: session.user.id };
}

export async function POST(req: Request) {
  let auth: { tenantId: string; userId: string };
  try {
    auth = await authorize(req);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unauthorized" },
      { status: 401 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const rl = await checkRateLimit({ tier: "agent", identifier: `agent:${auth.tenantId}` });
  if (!rl.ok) return rateLimitResponse(rl);

  const verdict = await checkBudget({ tenantId: auth.tenantId, kind: "llm" });
  if (!verdict.allowed) {
    return NextResponse.json({ error: verdict.reason }, { status: 402 });
  }

  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, auth.tenantId))
    .limit(1);
  if (!tenant) return NextResponse.json({ error: "unknown tenant" }, { status: 404 });
  const [profile] = await db
    .select({
      category: businessProfile.category,
      address: businessProfile.address,
      services: businessProfile.services,
      brandVoice: businessProfile.brandVoice,
    })
    .from(businessProfile)
    .where(eq(businessProfile.tenantId, auth.tenantId))
    .limit(1);

  const sessionId = randomUUID();
  const runStarted = Date.now();
  const stepIds: string[] = [];

  async function recordRun(input: Parameters<Parameters<typeof dispatchTool>[0]["recordRun"]>[0]) {
    const [row] = await db
      .insert(autoRosieRuns)
      .values({
        tenantId: auth.tenantId,
        ruleName: input.ruleName,
        status: input.status,
        inputs: { ...(input.inputs ?? {}), agentSessionId: sessionId },
        outputs: input.outputs,
        diff: input.diff,
        undoToken: input.undoable ? randomUUID() : null,
        error: input.error,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        actionId: input.actionId,
        durationMs: input.durationMs ? input.durationMs.toString() : null,
      })
      .returning({ id: autoRosieRuns.id });
    if (row?.id) stepIds.push(row.id);
    return row?.id ?? "";
  }

  try {
    const result = await runAgent({
      context: {
        tenantName: tenant.name,
        category: profile?.category ?? undefined,
        city: profile?.address?.city ?? undefined,
        services: profile?.services ?? undefined,
      },
      tools: AGENT_TOOLS,
      task: parsed.data.task,
      maxSteps: parsed.data.maxSteps ?? 8,
      dispatch: async (call: AgentToolInvocation) =>
        dispatchTool(
          {
            tenantId: auth.tenantId,
            userId: auth.userId,
            rosie: {
              tenantName: tenant.name,
              category: profile?.category ?? undefined,
              city: profile?.address?.city ?? undefined,
              services: profile?.services ?? undefined,
            },
            brandVoice: profile?.brandVoice ?? undefined,
            recordRun,
          },
          call,
        ),
    });

    // Record LLM usage (aggregated across all steps).
    for (const step of result.steps) {
      await recordLlmUsage(
        auth.tenantId,
        step.usage.model,
        step.usage.inputTokens,
        step.usage.outputTokens,
        "agent",
        {
          cacheReadTokens: step.usage.cacheReadTokens,
          cacheCreationTokens: step.usage.cacheCreationTokens,
          sessionId,
        },
      );
    }

    // Log a "session summary" row so the UI can group steps by session.
    await db.insert(autoRosieRuns).values({
      tenantId: auth.tenantId,
      ruleName: "agent:session",
      status: "success",
      inputs: { agentSessionId: sessionId, task: parsed.data.task },
      outputs: {
        finalText: result.finalText,
        toolCallCount: result.toolCallCount,
        stopReason: result.stopReason,
        stepCount: result.steps.length,
        stepRunIds: stepIds,
      },
      durationMs: (Date.now() - runStarted).toString(),
      usage: result.steps.reduce(
        (acc, s) => ({
          model: s.usage.model,
          inputTokens: (acc.inputTokens ?? 0) + s.usage.inputTokens,
          outputTokens: (acc.outputTokens ?? 0) + s.usage.outputTokens,
          cacheReadTokens: (acc.cacheReadTokens ?? 0) + s.usage.cacheReadTokens,
        }),
        {} as {
          model?: string;
          inputTokens?: number;
          outputTokens?: number;
          cacheReadTokens?: number;
        },
      ),
    });

    return NextResponse.json({ ok: true, sessionId, ...result });
  } catch (e) {
    await db.insert(autoRosieRuns).values({
      tenantId: auth.tenantId,
      ruleName: "agent:session",
      status: "failed",
      inputs: { agentSessionId: sessionId, task: parsed.data.task },
      error: e instanceof Error ? e.message : String(e),
      durationMs: (Date.now() - runStarted).toString(),
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "agent failed" },
      { status: 500 },
    );
  }
}
