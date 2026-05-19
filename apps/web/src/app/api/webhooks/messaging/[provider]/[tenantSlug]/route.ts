import { NextResponse } from "next/server";
import { getProvider, isProviderName } from "@rosie/messaging";
import { assertProviderName, ingestInboundMessage, resolveTenantBySlug } from "@/lib/conversations";
import { db, integrations, messages } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { detectLanguage } from "@rosie/ai";
import { emitEvent } from "@/lib/webhooks-out";
import { decryptJson } from "@/lib/crypto";
import { verifyTenantWebhook } from "@/lib/webhook-verify";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { enrollLead, stopCadencesForLeadOnReply } from "@/lib/cadences/engine";
import { triggerLeadAssistant } from "@/lib/lead-assistant";
import {
  detectSmsKeyword,
  helpReplyText,
  recordOptOut,
  removeOptOut,
  startConfirmationText,
  stopConfirmationText,
} from "@/lib/compliance/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string; tenantSlug: string }> },
) {
  const { provider: providerParam, tenantSlug } = await params;

  if (!isProviderName(providerParam)) {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }
  const providerName = assertProviderName(providerParam);

  const rl = await checkRateLimit({
    tier: "webhook",
    identifier: `${providerName}:${tenantSlug}`,
  });
  if (!rl.ok) return rateLimitResponse(rl);

  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ error: "unknown tenant" }, { status: 404 });
  }

  // Look up the integration row to get the per-tenant webhook secret.
  const integ = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.tenantId, tenant.id), eq(integrations.provider, providerName)))
    .limit(1);

  const expectedSecret = integ[0]?.webhookSecret ?? null;
  const rawBody = await req.text();
  // Prefer HMAC verification when the provider supports it; fall back to
  // bearer-style for pre-7 setups that haven't enabled signing.
  const scheme = providerName === "openphone" ? "openphone" : "bare-hex";
  const hmac = verifyTenantWebhook(rawBody, req.headers, expectedSecret, scheme);
  const bearer =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  const bearerOk = expectedSecret ? bearer === expectedSecret : true;
  if (!hmac.ok && !bearerOk) {
    return NextResponse.json(
      { error: hmac.reason ?? "unauthorized" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k] = v));

  const provider = getProvider(providerName);
  const decryptedSecrets = decryptJson<{
    apiKey?: string;
    fromId?: string;
    fromNumber?: string;
  }>(integ[0]?.secrets);
  const creds = {
    apiKey: decryptedSecrets?.apiKey ?? "",
    fromId: decryptedSecrets?.fromId,
    fromNumber: decryptedSecrets?.fromNumber,
    webhookSecret: expectedSecret ?? undefined,
  };

  const parsed = await provider.parseInbound(body, headers, creds);
  if (!parsed) {
    // Non-message event (delivery receipt, status update, etc.). Ack and ignore.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await ingestInboundMessage(tenant.id, parsed);

  // Best-effort language detection on the inbound text — fire-and-forget, so
  // a Claude hiccup never delays an SMS ack.
  if (result.messageId && parsed.body) {
    detectLanguage(parsed.body)
      .then((lang) =>
        db.update(messages).set({ language: lang }).where(eq(messages.id, result.messageId!)),
      )
      .catch((e) => console.warn("[i18n] detect failed", e));
  }

  // TCPA: STOP/HELP/START handling. Detect on the raw body, act before any
  // cadence/assistant logic could fire another outbound to a now-opted-out number.
  const keyword = detectSmsKeyword(parsed.body);
  const fromNumber = parsed.fromNumber;
  if (keyword.intent && fromNumber) {
    const brandName =
      (tenant.brandTheme as { displayName?: string } | null)?.displayName ?? tenant.name;
    let reply: string | null = null;
    if (keyword.intent === "stop") {
      await recordOptOut({
        tenantId: tenant.id,
        phone: fromNumber,
        source: "sms_keyword",
        keyword: keyword.keyword ?? undefined,
      });
      // Stop any in-flight cadences immediately.
      if (result.leadId) {
        stopCadencesForLeadOnReply(tenant.id, result.leadId).catch((e) =>
          console.error("stop cadences failed", e),
        );
      }
      reply = stopConfirmationText(brandName);
    } else if (keyword.intent === "help") {
      reply = helpReplyText(brandName, null);
    } else if (keyword.intent === "start") {
      await removeOptOut(tenant.id, fromNumber);
      reply = startConfirmationText(brandName);
    }

    // Send the one mandated auto-reply if we have provider creds.
    if (reply && creds.apiKey) {
      try {
        await provider.sendSms(
          { to: fromNumber, body: reply },
          { apiKey: creds.apiKey, fromId: creds.fromId, fromNumber: creds.fromNumber },
        );
      } catch (e) {
        console.error("auto-reply send failed", e);
      }
    }
    return NextResponse.json({ ok: true, ...result, keyword: keyword.intent });
  }

  // Fan out conversation.message_received to subscribers.
  if (result.messageId) {
    emitEvent(tenant.id, "conversation.message_received", {
      messageId: result.messageId,
      conversationId: result.conversationId,
      leadId: result.leadId,
      body: parsed.body,
      fromNumber: parsed.fromNumber,
      provider: providerParam,
      receivedAt: parsed.receivedAt.toISOString(),
    }).catch((e) => console.error("outbound webhook fan-out failed", e));
  }

  if (result.leadId) {
    // Inbound reply: stop any running cadences for this lead, then either enroll
    // (if brand-new lead) or skip.
    stopCadencesForLeadOnReply(tenant.id, result.leadId).catch((e) =>
      console.error("stop cadences failed", e),
    );
    if (result.isNewConversation) {
      enrollLead({ tenantId: tenant.id, leadId: result.leadId, trigger: "lead_created" }).catch(
        (e) => console.error("cadence enroll failed", e),
      );
      triggerLeadAssistant({ tenantId: tenant.id, leadId: result.leadId }).catch((e) =>
        console.error("lead assistant trigger failed", e),
      );
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
