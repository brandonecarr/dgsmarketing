/**
 * Minimal Vapi client. Docs: https://docs.vapi.ai
 *
 * Tenant-scoped credentials live in integrations row with provider='vapi'
 * (we use the same pattern as the messaging providers).
 */

export class VapiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "VapiError";
  }
}

interface VapiCreds {
  apiKey: string;
  /** The assistant id the tenant configured in Vapi for inbound + outbound. */
  assistantId?: string;
  /** Vapi phoneNumberId to place outbound from. */
  phoneNumberId?: string;
  /** Per-tenant webhook secret presented in inbound calls. */
  webhookSecret?: string;
}

const BASE_URL = process.env.VAPI_API_BASE_URL ?? "https://api.vapi.ai";

async function vapi<T>(path: string, init: RequestInit & { apiKey: string }): Promise<T> {
  const { apiKey, ...rest } = init;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new VapiError(`Vapi ${res.status}: ${text}`, res.status);
  }
  return (await res.json()) as T;
}

export async function placeOutboundCall(
  creds: VapiCreds,
  opts: { toNumber: string; firstMessage?: string; metadata?: Record<string, unknown> },
): Promise<{ id: string }> {
  if (!creds.assistantId || !creds.phoneNumberId) {
    throw new VapiError("Vapi assistantId and phoneNumberId required", 412);
  }
  return vapi<{ id: string }>("/call", {
    method: "POST",
    apiKey: creds.apiKey,
    body: JSON.stringify({
      assistantId: creds.assistantId,
      phoneNumberId: creds.phoneNumberId,
      customer: { number: opts.toNumber },
      assistantOverrides: opts.firstMessage
        ? { firstMessage: opts.firstMessage }
        : undefined,
      metadata: opts.metadata,
    }),
  });
}

/**
 * Normalize a Vapi webhook event into the shape we store in `calls`.
 * Returns null for non-call events (chat messages, transcripts mid-call, etc.)
 * that we don't currently care about.
 */
export type VapiCallSummary = {
  externalId: string;
  direction: "inbound" | "outbound";
  fromNumber: string | null;
  toNumber: string | null;
  status:
    | "queued"
    | "ringing"
    | "in_progress"
    | "completed"
    | "no_answer"
    | "failed"
    | "voicemail";
  transcript: string | null;
  summary: string | null;
  durationSec: number | null;
  recordingUrl: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
};

interface VapiEvent {
  type?: string;
  message?: { type?: string };
  call?: {
    id?: string;
    type?: string;
    status?: string;
    customer?: { number?: string };
    phoneNumber?: { number?: string };
    transcript?: string;
    summary?: string;
    startedAt?: string;
    endedAt?: string;
    recordingUrl?: string;
    endedReason?: string;
  };
}

export function parseVapiEvent(raw: unknown): VapiCallSummary | null {
  const evt = raw as VapiEvent;
  // Vapi sends end-of-call-report events with the full transcript.
  const type = evt.type ?? evt.message?.type;
  if (type !== "end-of-call-report" && type !== "status-update") return null;
  const call = evt.call;
  if (!call?.id) return null;

  let status: VapiCallSummary["status"] = "in_progress";
  switch (call.status) {
    case "queued":
      status = "queued";
      break;
    case "ringing":
      status = "ringing";
      break;
    case "in-progress":
    case "in_progress":
      status = "in_progress";
      break;
    case "ended":
    case "completed":
      status = call.endedReason === "customer-did-not-answer" ? "no_answer" : "completed";
      break;
    case "failed":
      status = "failed";
      break;
    default:
      status = "in_progress";
  }
  if (call.endedReason === "voicemail") status = "voicemail";

  return {
    externalId: call.id,
    direction: call.type === "outboundPhoneCall" ? "outbound" : "inbound",
    fromNumber: call.customer?.number ?? null,
    toNumber: call.phoneNumber?.number ?? null,
    status,
    transcript: call.transcript ?? null,
    summary: call.summary ?? null,
    durationSec:
      call.startedAt && call.endedAt
        ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
        : null,
    recordingUrl: call.recordingUrl ?? null,
    startedAt: call.startedAt ? new Date(call.startedAt) : null,
    endedAt: call.endedAt ? new Date(call.endedAt) : null,
  };
}
