export type ProviderName = "quo" | "openphone";
export type Channel = "sms" | "email" | "call" | "fb_dm" | "ig_dm";

export interface SendSmsOptions {
  to: string;
  from?: string;
  body: string;
  /** Provider-specific phone-number id (e.g. OpenPhone phoneNumberId). */
  fromId?: string;
}

export interface SentMessage {
  provider: ProviderName;
  externalId: string;
  to: string;
  from: string;
  body: string;
  sentAt: Date;
}

export interface InboundMessage {
  provider: ProviderName;
  channel: Channel;
  /** Provider's unique id for this message — used for idempotency. */
  externalId: string;
  /** Provider's conversation id (if applicable). */
  externalConversationId?: string;
  fromNumber: string;
  toNumber: string;
  /** Display name if the provider supplied one. */
  fromName?: string;
  body: string;
  receivedAt: Date;
  raw: unknown;
}

export interface ProviderCredentials {
  apiKey: string;
  /** Phone number id / route the tenant publishes from. */
  fromId?: string;
  /** From phone number for SMS (E.164). */
  fromNumber?: string;
  /** Webhook signing secret per tenant. */
  webhookSecret?: string;
}

export interface MessagingProvider {
  name: ProviderName;
  sendSms(opts: SendSmsOptions, creds: ProviderCredentials): Promise<SentMessage>;
  /**
   * Parses an inbound webhook request into a normalized message.
   * Returns null if the payload is a non-message event (delivery receipt, etc.).
   */
  parseInbound(
    body: unknown,
    headers: Record<string, string>,
    creds: ProviderCredentials,
  ): Promise<InboundMessage | null>;
}

export class MessagingError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MessagingError";
  }
}
