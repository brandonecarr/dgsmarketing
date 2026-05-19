import { openPhone } from "./providers/openphone";
import { quo } from "./providers/quo";
import type { MessagingProvider, ProviderName } from "./types";

const REGISTRY: Record<ProviderName, MessagingProvider> = {
  quo,
  openphone: openPhone,
};

export function getProvider(name: ProviderName): MessagingProvider {
  const p = REGISTRY[name];
  if (!p) throw new Error(`Unknown messaging provider: ${name}`);
  return p;
}

export function isProviderName(value: string): value is ProviderName {
  return value === "quo" || value === "openphone";
}
