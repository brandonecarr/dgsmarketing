export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Minimal business context Rosie always gets in her system prompt. */
export interface RosieContext {
  tenantName: string;
  category?: string;
  city?: string;
  services?: string[];
  /** Free-text snapshot of the gauges + KPIs, generated upstream. Optional in Phase 0. */
  performanceSnapshot?: string;
}

export interface StreamChunk {
  type: "text" | "done";
  delta?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    model: string;
  };
}
