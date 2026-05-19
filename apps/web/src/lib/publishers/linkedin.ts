import { db, integrations } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { decryptJson } from "@/lib/crypto";
import { PublisherError, type PublisherDriver } from "./types";

interface LinkedInConfig {
  accessToken?: string;
  /** Author URN — `urn:li:person:{id}` for personal, `urn:li:organization:{id}` for company. */
  authorUrn?: string;
}

export const linkedin: PublisherDriver = {
  name: "linkedin",
  async publish({ tenantId, input }) {
    const [row] = await db
      .select()
      .from(integrations)
      // LinkedIn doesn't have its own provider enum value yet; reusing "make" as a
      // placeholder until the schema gains a `linkedin` provider. Operators who
      // wire LinkedIn directly should write to integrations.linkedin manually
      // OR we'll add the enum value in a future migration.
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, "make")))
      .limit(1);
    if (!row?.secrets) throw new PublisherError("LinkedIn not connected for this tenant");
    const cfg = decryptJson<LinkedInConfig>(row.secrets);
    if (!cfg?.accessToken || !cfg.authorUrn) {
      throw new PublisherError("LinkedIn accessToken + authorUrn required");
    }

    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        author: cfg.authorUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: input.body },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    if (!res.ok) {
      throw new PublisherError(`LinkedIn publish ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new PublisherError("LinkedIn publish: missing id");
    return { externalId: json.id, publishedAt: new Date() };
  },
};
