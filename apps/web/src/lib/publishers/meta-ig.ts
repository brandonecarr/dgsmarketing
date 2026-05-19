import { db, integrations } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { decryptJson } from "@/lib/crypto";
import { PublisherError, type PublisherDriver } from "./types";

interface IgConfig {
  pageAccessToken?: string;
  accessToken?: string;
  /** Instagram Business Account id linked to the FB page. */
  igUserId?: string;
}

const BASE = "https://graph.facebook.com/v18.0";

export const metaInstagram: PublisherDriver = {
  name: "instagram",
  async publish({ tenantId, input }) {
    const [row] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, "meta")))
      .limit(1);
    if (!row?.secrets) throw new PublisherError("Meta not connected for this tenant");
    const cfg = decryptJson<IgConfig>(row.secrets);
    if (!cfg?.igUserId) {
      throw new PublisherError(
        "Instagram Business Account id not configured. Pick the linked IG account on Settings → Publishing.",
      );
    }
    const token = cfg.pageAccessToken ?? cfg.accessToken;
    if (!token) throw new PublisherError("Meta access token missing");
    if (!input.mediaUrls?.[0]) {
      throw new PublisherError("IG requires an image — set mediaUrls[0]");
    }

    // IG publishing is a two-step container flow.
    const createRes = await fetch(`${BASE}/${cfg.igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: input.mediaUrls[0],
        caption: input.body,
        access_token: token,
      }),
    });
    if (!createRes.ok) {
      throw new PublisherError(`IG create ${createRes.status}: ${await createRes.text()}`);
    }
    const created = (await createRes.json()) as { id?: string };
    if (!created.id) throw new PublisherError("IG create: missing container id");

    const pubRes = await fetch(`${BASE}/${cfg.igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: created.id, access_token: token }),
    });
    if (!pubRes.ok) {
      throw new PublisherError(`IG publish ${pubRes.status}: ${await pubRes.text()}`);
    }
    const pub = (await pubRes.json()) as { id?: string };
    if (!pub.id) throw new PublisherError("IG publish: missing media id");
    return { externalId: pub.id, publishedAt: new Date() };
  },
};
