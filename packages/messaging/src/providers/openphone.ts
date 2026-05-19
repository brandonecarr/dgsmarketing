import { MessagingError, type MessagingProvider } from "../types";

/**
 * OpenPhone provider. API docs: https://www.openphone.com/docs/api
 * Outbound: POST https://api.openphone.com/v1/messages
 *   headers: { Authorization: <apiKey>, "Content-Type": "application/json" }
 *   body: { from: phoneNumberId, to: ["+1..."], content }
 *
 * Inbound webhook payload (simplified):
 *   { type: "message.received", data: { object: {
 *       id, conversationId, from, to: [..], body, createdAt
 *   }}}
 */
export const openPhone: MessagingProvider = {
  name: "openphone",

  async sendSms(opts, creds) {
    if (!creds.apiKey) throw new MessagingError("OpenPhone apiKey missing");
    if (!creds.fromId && !opts.fromId) {
      throw new MessagingError("OpenPhone requires fromId (phoneNumberId)");
    }
    const res = await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: creds.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: opts.fromId ?? creds.fromId,
        to: [opts.to],
        content: opts.body,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new MessagingError(`OpenPhone send failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as {
      data?: { id: string; from: string; to: string[]; body: string; createdAt: string };
    };
    const d = json.data;
    if (!d) throw new MessagingError("OpenPhone send response missing data");
    return {
      provider: "openphone",
      externalId: d.id,
      to: d.to[0] ?? opts.to,
      from: d.from,
      body: d.body,
      sentAt: new Date(d.createdAt),
    };
  },

  async parseInbound(body) {
    const payload = body as {
      type?: string;
      data?: {
        object?: {
          id?: string;
          conversationId?: string;
          from?: string;
          to?: string[];
          body?: string;
          createdAt?: string;
        };
      };
    };
    if (payload.type !== "message.received") return null;
    const obj = payload.data?.object;
    if (!obj?.id || !obj.from || !obj.body) return null;
    return {
      provider: "openphone",
      channel: "sms",
      externalId: obj.id,
      externalConversationId: obj.conversationId,
      fromNumber: obj.from,
      toNumber: obj.to?.[0] ?? "",
      body: obj.body,
      receivedAt: obj.createdAt ? new Date(obj.createdAt) : new Date(),
      raw: body,
    };
  },
};
