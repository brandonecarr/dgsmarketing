import { metaFacebook } from "./meta-fb";
import { metaInstagram } from "./meta-ig";
import { googleBusiness } from "./gbp";
import { linkedin } from "./linkedin";
import { tiktok } from "./tiktok";
import type { PublishPlatform, PublisherDriver } from "./types";

const REGISTRY: Record<PublishPlatform, PublisherDriver> = {
  facebook: metaFacebook,
  instagram: metaInstagram,
  google_business: googleBusiness,
  linkedin,
  tiktok,
};

export function getPublisher(platform: PublishPlatform): PublisherDriver {
  const d = REGISTRY[platform];
  if (!d) throw new Error(`Unknown publish platform: ${platform}`);
  return d;
}
