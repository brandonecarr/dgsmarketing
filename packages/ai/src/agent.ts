import Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODELS } from "./client";
import type { RosieContext } from "./types";

export interface AgentTool {
  name: string;
  description: string;
  /** Anthropic tool input_schema (JSON Schema). */
  input_schema: Record<string, unknown>;
}

export interface AgentToolInvocation {
  name: string;
  input: Record<string, unknown>;
  id: string;
}

export type AgentToolResult =
  | { kind: "ok"; content: unknown }
  | { kind: "error"; message: string };

export interface AgentStep {
  /** The tool calls the model decided to invoke this turn. */
  invocations: AgentToolInvocation[];
  /** The model's plain-text reply for this turn (may be empty). */
  text: string;
  /** Token usage from this turn. */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    model: string;
  };
}

export interface AgentRunResult {
  finalText: string;
  steps: AgentStep[];
  stopReason: string;
  toolCallCount: number;
}

export interface RunAgentOpts {
  context: RosieContext;
  /** Tool catalog the agent may use this run. */
  tools: AgentTool[];
  /** Async dispatcher that runs a single tool and returns its result. */
  dispatch: (call: AgentToolInvocation) => Promise<AgentToolResult>;
  /** Operator task. Defaults to "Review the funnel and propose / take next moves." */
  task?: string;
  maxSteps?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

function systemPrompt(ctx: RosieContext, taskHint?: string): string {
  return [
    "You are Rosie, an always-on AI marketing operator for a local service business.",
    "You can act through the provided tools. Prefer reading first, then acting, then summarizing.",
    "",
    "Operating rules:",
    "- Do not invent numbers, leads, or campaigns. If a tool gives you nothing, say so.",
    "- Take at most one outbound action per lead per run (e.g. don't both send SMS and advance stage in the same pass).",
    "- For anything that touches a customer (SMS, stage move, post publish), explain WHY in one short sentence before calling the tool.",
    "- Stop and summarize as soon as you've done one useful round of work. Don't keep calling tools to look busy.",
    "- Never call `send_sms` without first calling `draft_sms_reply` for the same conversation OR being given an operator-approved body.",
    "",
    `Business: ${ctx.tenantName}${ctx.category ? ` · ${ctx.category}` : ""}${ctx.city ? ` · ${ctx.city}` : ""}`,
    ctx.services?.length ? `Services: ${ctx.services.join(", ")}` : "",
    "",
    taskHint ? `Task hint from operator: ${taskHint}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const DEFAULT_TASK =
  "Review the funnel and take or propose the highest-leverage next moves. Read first, then act, then summarize what you did.";

export async function runAgent(opts: RunAgentOpts): Promise<AgentRunResult> {
  const client = anthropic();
  const maxSteps = opts.maxSteps ?? 8;
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: opts.task ?? DEFAULT_TASK },
  ];
  const steps: AgentStep[] = [];
  let stopReason = "max_steps";
  let toolCallCount = 0;
  let finalText = "";

  for (let step = 0; step < maxSteps; step++) {
    const res = await client.messages.create(
      {
        model: MODELS.strategy,
        max_tokens: opts.maxTokens ?? 1500,
        system: [
          {
            type: "text",
            text: systemPrompt(opts.context, opts.task),
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: opts.tools as unknown as Anthropic.Messages.Tool[],
        messages,
      },
      { signal: opts.signal },
    );

    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    const invocations: AgentToolInvocation[] = res.content
      .filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({
        id: b.id,
        name: b.name,
        input: (b.input ?? {}) as Record<string, unknown>,
      }));

    const stepRecord: AgentStep = {
      invocations,
      text,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        cacheCreationTokens: res.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
        model: res.model,
      },
    };
    steps.push(stepRecord);

    // Append the model's turn to the conversation as-is so tool_use ids match.
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason === "end_turn" || invocations.length === 0) {
      stopReason = res.stop_reason ?? "end_turn";
      finalText = text;
      break;
    }

    // Execute each tool call in order and collect results.
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const call of invocations) {
      toolCallCount += 1;
      const result = await opts.dispatch(call);
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        is_error: result.kind === "error",
        content:
          result.kind === "ok"
            ? typeof result.content === "string"
              ? result.content
              : JSON.stringify(result.content)
            : result.message,
      });
    }

    messages.push({ role: "user", content: toolResults });
    stopReason = res.stop_reason ?? "tool_use";
  }

  return { finalText, steps, stopReason, toolCallCount };
}
