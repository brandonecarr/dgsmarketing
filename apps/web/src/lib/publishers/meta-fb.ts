import { db, integrations } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { decryptJson } from "@/lib/crypto";
import { PublisherError, type PublisherDriver } from "./types";

interface MetaPostingConfig {
  /** User access token from the Phase 8 Meta OAuth flow. */
  accessToken?: string;
  /** Selected FB page id. */
  pageId?: string;
  /** Selected FB page's access token (long-lived). */
  pageAccessToken?: string;
}

async function getPostingConfig(tenantId: string): Promise<MetaPostingConfig> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, "meta")))
    .limit(1);
  if (!row?.secrets) throw new PublisherError("Meta not connected for this tenant");
  const decrypted = decryptJson<MetaPostingConfig>(row.secrets);
  if (!decrypted) throw new PublisherError("Meta credentials unreadable");
  return decrypted;
}

const FB_BASE = "https://graph.facebook.com/v18.0";

export const metaFacebook: PublisherDriver = {
  name: "facebook",
  async publish({ tenantId, input }) {
    const cfg = await getPostingConfig(tenantId);
    if (!cfg.pageId) {
      throw new PublisherError(
        "Meta Page ID not configured. Pick a page on Settings → Publishing.",
      );
    }
    const token = cfg.pageAccessToken ?? cfg.accessToken;
    if (!token) throw new PublisherError("Meta access token missing");

    // Photo posts go to /photos with `caption`; text posts go to /feed with `message`.
    const hasImage = (input.mediaUrls?.length ?? 0) > 0;
    const endpoint = hasImage
      ? `${FB_BASE}/${cfg.pageId}/photos`
      : `${FB_BASE}/${cfg.pageId}/feed`;
    const body = hasImage
      ? { url: input.mediaUrls![0], caption: input.body, access_token: token }
      : { message: input.body, access_token: token };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      const retryable = res.status >= 500 || res.status === 429;
      throw new PublisherError(`FB publish ${res.status}: ${text}`, retryable);
    }
    const json = (await res.json()) as { id?: string; post_id?: string };
    const externalId = json.post_id ?? json.id ?? "";
    if (!externalId) throw new PublisherError("FB publish: missing id in response");
    return {
      externalId,
      publishedAt: new Date(),
      permalink: `https://facebook.com/${externalId}`,
    };
  },
};
