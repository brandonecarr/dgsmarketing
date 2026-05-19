import { PublisherError, type PublisherDriver } from "./types";

/**
 * TikTok organic posting is gated behind the Content Posting API which requires
 * app review for the `video.publish` scope. Until that's approved, this driver
 * fails-soft with a clear message so scheduled-post fan-out doesn't crash on
 * TikTok rows.
 *
 * To enable: register an app at https://developers.tiktok.com, get the
 * Content Posting product approved, OAuth in with `video.upload` + `video.publish`,
 * and replace this body with the real /video/publish flow.
 */
export const tiktok: PublisherDriver = {
  name: "tiktok",
  async publish() {
    throw new PublisherError(
      "TikTok organic posting requires Content Posting API approval. " +
        "Save the post as draft; we'll re-attempt once you wire app credentials.",
      false,
    );
  },
};
