import { createLocalPost } from "@/lib/google/gbp";
import { db, integrations } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { decryptJson } from "@/lib/crypto";
import { PublisherError, type PublisherDriver } from "./types";

interface GbpPostingConfig {
  /** Full resource name: `accounts/{aid}/locations/{lid}`. */
  locationName?: string;
}

export const googleBusiness: PublisherDriver = {
  name: "google_business",
  async publish({ tenantId, input }) {
    const [row] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, "google")))
      .limit(1);
    if (!row?.secrets) throw new PublisherError("Google not connected for this tenant");
    const cfg = decryptJson<GbpPostingConfig>(row.secrets);
    if (!cfg?.locationName) {
      throw new PublisherError(
        "GBP location name missing. Set integrations.google.secrets.locationName.",
      );
    }
    try {
      const result = await createLocalPost(tenantId, cfg.locationName, {
        summary: input.body,
      });
      return { externalId: result.name, publishedAt: new Date() };
    } catch (e) {
      throw new PublisherError(`GBP publish failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
};
