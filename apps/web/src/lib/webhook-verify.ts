import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Time-tolerant HMAC SHA-256 verification used by inbound webhooks.
 *
 * OpenPhone sends: `openphone-signature: t=<unix-seconds>;v=<base64-hmac>`
 *   where the signed payload is `<timestamp>.<body>` and the secret is the
 *   per-tenant webhook secret.
 * Vapi sends: `x-vapi-signature: <hex-hmac>` of the raw body.
 * Quo: assume the same pattern (configurable when an account is provisioned).
 */

export interface HmacVerifyOpts {
  body: string;
  signatureHeader: string | null;
  secret: string;
  /** Maximum age in seconds (defaults to 5 minutes). */
  toleranceSeconds?: number;
}

function timingSafeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** OpenPhone-style: `t=...;v=base64(hmac(t + . + body))` */
export function verifyOpenPhoneSignature(opts: HmacVerifyOpts): boolean {
  if (!opts.signatureHeader || !opts.secret) return false;
  const parts = Object.fromEntries(
    opts.signatureHeader.split(";").map((p) => {
      const [k, ...rest] = p.split("=");
      return [k?.trim() ?? "", rest.join("=").trim()] as const;
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v;
  if (!timestamp || !signature) return false;

  const t = Number(timestamp);
  if (!Number.isFinite(t)) return false;
  const ageSec = Math.abs(Date.now() / 1000 - t);
  if (ageSec > (opts.toleranceSeconds ?? 300)) return false;

  const expected = createHmac("sha256", opts.secret)
    .update(`${timestamp}.${opts.body}`)
    .digest("base64");
  return timingSafeEq(signature, expected);
}

/** Bare-HMAC style (Vapi, Quo default): `<hex|base64>(hmac(body))` */
export function verifyBareSignature(opts: HmacVerifyOpts & { encoding?: "hex" | "base64" }): boolean {
  if (!opts.signatureHeader || !opts.secret) return false;
  const enc = opts.encoding ?? "hex";
  const expected = createHmac("sha256", opts.secret).update(opts.body).digest(enc);
  // Strip an optional `sha256=` prefix.
  const presented = opts.signatureHeader.replace(/^sha256=/, "").trim();
  return timingSafeEq(presented, expected);
}

/**
 * Returns true if either (a) no webhook secret is configured (back-compat with
 * pre-Phase-7 tenants) or (b) the signature checks out. Logs but does NOT
 * fail-open when a secret IS set and verification fails.
 */
export function verifyTenantWebhook(
  rawBody: string,
  headers: Headers,
  configuredSecret: string | null,
  scheme: "openphone" | "bare-hex" | "bare-base64",
): { ok: boolean; reason?: string } {
  if (!configuredSecret) return { ok: true };

  if (scheme === "openphone") {
    const sig = headers.get("openphone-signature");
    return verifyOpenPhoneSignature({
      body: rawBody,
      signatureHeader: sig,
      secret: configuredSecret,
    })
      ? { ok: true }
      : { ok: false, reason: "openphone signature mismatch" };
  }

  const sig =
    headers.get("x-rosie-signature") ??
    headers.get("x-vapi-signature") ??
    headers.get("x-quo-signature") ??
    headers.get("x-webhook-signature");
  return verifyBareSignature({
    body: rawBody,
    signatureHeader: sig,
    secret: configuredSecret,
    encoding: scheme === "bare-base64" ? "base64" : "hex",
  })
    ? { ok: true }
    : { ok: false, reason: "signature mismatch" };
}
