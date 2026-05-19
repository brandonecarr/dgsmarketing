import { MessagingError, type MessagingProvider } from "../types";

/**
 * Quo provider. Adapter shape mirrors Quo's typical REST + webhook pattern.
 *
 * NOTE: Replace BASE_URL + the request/response shapes with the exact
 * endpoints from Quo's developer docs when an account is provisioned.
 * The interface is stable; only this file changes.
 *
 * Expected env-default config:
 *   creds.apiKey         — bearer token
 *   creds.fromNumber     — E.164 outbound number
 *   creds.webhookSecret  — used to verify inbound webhook signatures
 */
const BASE_URL = process.env.QUO_API_BASE_URL ?? "https://api.usequo.com/v1";

export const quo: MessagingProvider = {
  name: "quo",

  async sendSms(opts, creds) {
    if (!creds.apiKey) throw new MessagingError("Quo apiKey missing");
    const from = opts.from ?? creds.fromNumber;
    if (!from) throw new MessagingError("Quo requires a from number");

    const res = await fetch(`${BASE_URL}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        body: opts.body,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new MessagingError(`Quo send failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as {
      id?: string;
      from?: string;
      to?: string;
      body?: string;
      sent_at?: string;
    };
    if (!json.id) throw new MessagingError("Quo send response missing id");
    return {
      provider: "quo",
      externalId: json.id,
      to: json.to ?? opts.to,
      from: json.from ?? from,
      body: json.body ?? opts.body,
      sentAt: json.sent_at ? new Date(json.sent_at) : new Date(),
    };
  },

  async parseInbound(body) {
    const payload = body as {
      event?: string;
      message?: {
        id?: string;
        conversation_id?: string;
        from?: string;
        to?: string;
        from_name?: string;
        body?: string;
        received_at?: string;
      };
    };
    if (payload.event !== "message.inbound") return null;
    const m = payload.message;
    if (!m?.id || !m.from || !m.body) return null;
    return {
      provider: "quo",
      channel: "sms",
      externalId: m.id,
      externalConversationId: m.conversation_id,
      fromNumber: m.from,
      toNumber: m.to ?? "",
      fromName: m.from_name,
      body: m.body,
      receivedAt: m.received_at ? new Date(m.received_at) : new Date(),
      raw: body,
    };
  },
};
