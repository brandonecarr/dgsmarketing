import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Envelope encryption for sensitive JSONB columns (integrations.secrets,
 * subscriptions.raw payloads, anything we don't want sitting in Postgres
 * as plaintext if a backup leaks).
 *
 * Format: { __enc: 1, v: "v1", iv: base64, tag: base64, data: base64 }
 *
 * Plaintext rows still round-trip — anything that doesn't have `__enc` is
 * passed through unchanged. This lets us roll out encryption per call site
 * without a big-bang migration.
 */

const ALG = "aes-256-gcm";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ROSIE_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ROSIE_ENCRYPTION_KEY is required for at-rest encryption. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  // Accept base64, hex, or any string — hash it down to 32 bytes so format mistakes never crash.
  cachedKey = createHash("sha256").update(raw).digest();
  return cachedKey;
}

interface EncryptedEnvelope {
  __enc: 1;
  v: "v1";
  iv: string;
  tag: string;
  data: string;
}

function isEnvelope(value: unknown): value is EncryptedEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __enc?: number }).__enc === 1 &&
    typeof (value as { v?: string }).v === "string"
  );
}

export function encryptJson(plaintext: unknown): EncryptedEnvelope {
  const iv = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALG, key(), iv);
  const json = Buffer.from(JSON.stringify(plaintext), "utf8");
  const data = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    __enc: 1,
    v: "v1",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: data.toString("base64"),
  };
}

export function decryptJson<T = unknown>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (!isEnvelope(value)) return value as T; // plaintext passthrough
  try {
    const iv = Buffer.from(value.iv, "base64");
    const tag = Buffer.from(value.tag, "base64");
    if (tag.length !== TAG_BYTES) throw new Error("bad tag length");
    const decipher = createDecipheriv(ALG, key(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([
      decipher.update(Buffer.from(value.data, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(plain.toString("utf8")) as T;
  } catch (e) {
    console.error("decryptJson failed", e);
    return null;
  }
}

/** Quick check used at startup: throws if the key is missing. */
export function assertEncryptionConfigured(): void {
  key();
}
