export type PublishPlatform = "facebook" | "instagram" | "google_business" | "linkedin" | "tiktok";

export interface PublishInput {
  body: string;
  title?: string | null;
  mediaUrls?: string[] | null;
}

export interface PublishResult {
  externalId: string;
  publishedAt: Date;
  /** Public permalink when the platform returns one. */
  permalink?: string;
}

export class PublisherError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "PublisherError";
  }
}

export interface PublisherDriver {
  name: PublishPlatform;
  publish(opts: { tenantId: string; input: PublishInput }): Promise<PublishResult>;
}
