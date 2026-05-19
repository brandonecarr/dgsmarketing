import { Resend } from "resend";

/**
 * Resend-backed transactional email. No-ops cleanly when RESEND_API_KEY is
 * missing so dev/test environments don't need it.
 */

let _client: Resend | null = null;
function client(): Resend | null {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _client = new Resend(key);
  return _client;
}

interface SendOpts {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Optional From override; falls back to RESEND_FROM env. */
  from?: string;
  /** Used in Resend's tagging UI for filtering. */
  tags?: Array<{ name: string; value: string }>;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}

export async function sendEmail(opts: SendOpts): Promise<SendResult> {
  const c = client();
  if (!c) return { ok: true, skipped: true };
  const from =
    opts.from ?? process.env.RESEND_FROM ?? "Rosie <rosie@notifications.example.com>";
  try {
    const result = await c.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      tags: opts.tags,
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, id: result.data?.id };
  } catch (e) {
    console.error("Resend send failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
