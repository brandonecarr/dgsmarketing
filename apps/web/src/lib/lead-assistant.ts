import { randomUUID } from "node:crypto";
import { db, businessProfile, tenants, autoRosieRuns } from "@rosie/db";
import { eq } from "@rosie/db";
import { runAgent } from "@rosie/ai";
import { AGENT_TOOLS } from "./auto-rosie/agent/tools";
import { dispatchTool } from "./auto-rosie/agent/dispatch";
import { recordLlmUsage } from "./usage";

const DEFAULT_INSTRUCTION =
  "A brand-new lead just came in. Read the lead's full thread + attribution, " +
  "draft a warm, brief first reply that asks one specific qualifying question, " +
  "and send it. If you don't have enough context, create an Action Plan item " +
  "for the operator instead of sending. Do not advance the stage on this run.";

/**
 * Fires when a new lead lands. Reads the tenant's feature toggle and runs the
 * Auto-Rosie agent with a lead-specific instruction, fire-and-forget.
 */
export async function triggerLeadAssistant(opts: { tenantId: string; leadId: string }) {
  const [profile] = await db
    .select({
      features: businessProfile.features,
      category: businessProfile.category,
      address: businessProfile.address,
      services: businessProfile.services,
      brandVoice: businessProfile.brandVoice,
    })
    .from(businessProfile)
    .where(eq(businessProfile.tenantId, opts.tenantId))
    .limit(1);

  if (!profile?.features?.leadAssistantEnabled) return;

  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, opts.tenantId))
    .limit(1);
  if (!tenant) return;

  const sessionId = randomUUID();
  const instruction = `${profile.features.leadAssistantInstruction ?? DEFAULT_INSTRUCTION}\n\nFocus on lead id: ${opts.leadId}.`;

  try {
    const result = await runAgent({
      context: {
        tenantName: tenant.name,
        category: profile.category ?? undefined,
        city: profile.address?.city ?? undefined,
        services: profile.services ?? undefined,
      },
      tools: AGENT_TOOLS,
      task: instruction,
      maxSteps: 5,
      dispatch: async (call) =>
        dispatchTool(
          {
            tenantId: opts.tenantId,
            userId: "lead-assistant",
            rosie: {
              tenantName: tenant.name,
              category: profile.category ?? undefined,
              city: profile.address?.city ?? undefined,
              services: profile.services ?? undefined,
            },
            brandVoice: profile.brandVoice ?? undefined,
            recordRun: async (input) => {
              const [row] = await db
                .insert(autoRosieRuns)
                .values({
                  tenantId: opts.tenantId,
                  ruleName: input.ruleName,
                  status: input.status,
                  inputs: { ...(input.inputs ?? {}), agentSessionId: sessionId, source: "lead_assistant" },
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
              return row?.id ?? "";
            },
          },
          call,
        ),
    });

    for (const step of result.steps) {
      await recordLlmUsage(
        opts.tenantId,
        step.usage.model,
        step.usage.inputTokens,
        step.usage.outputTokens,
        "lead_assistant",
        { cacheReadTokens: step.usage.cacheReadTokens, sessionId },
      );
    }

    await db.insert(autoRosieRuns).values({
      tenantId: opts.tenantId,
      ruleName: "agent:lead_assistant_session",
      status: "success",
      inputs: { agentSessionId: sessionId, leadId: opts.leadId },
      outputs: {
        finalText: result.finalText,
        toolCallCount: result.toolCallCount,
        stopReason: result.stopReason,
      },
      relatedEntityType: "lead",
      relatedEntityId: opts.leadId,
    });
  } catch (e) {
    await db.insert(autoRosieRuns).values({
      tenantId: opts.tenantId,
      ruleName: "agent:lead_assistant_session",
      status: "failed",
      inputs: { agentSessionId: sessionId, leadId: opts.leadId },
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
