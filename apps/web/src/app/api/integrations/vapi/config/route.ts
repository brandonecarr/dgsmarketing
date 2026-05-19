import { NextResponse } from "next/server";
import { z } from "zod";
import { db, integrations } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { encryptJson, decryptJson } from "@/lib/crypto";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({
  apiKey: z.string().min(10).max(200).optional(),
  assistantId: z.string().max(120).optional(),
  phoneNumberId: z.string().max(120).optional(),
  /** Optional first-line script the assistant says when answering. */
  firstMessage: z.string().max(500).optional(),
  /** Optional system prompt override. */
  systemPrompt: z.string().max(8000).optional(),
  /** Optional Vapi voice id (eg "jennifer", "burt"). */
  voiceId: z.string().max(80).optional(),
  /** Optional model id, eg gpt-4o, claude-3-5-sonnet. */
  modelId: z.string().max(80).optional(),
});

interface VapiSecrets {
  apiKey?: string;
  assistantId?: string;
  phoneNumberId?: string;
  firstMessage?: string;
  systemPrompt?: string;
  voiceId?: string;
  modelId?: string;
  webhookSecret?: string;
}

export async function GET() {
  const session = await loadActiveSession();
  const [integ] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.tenantId, session.tenant.id), eq(integrations.provider, "vapi")))
    .limit(1);
  if (!integ?.secrets) return NextResponse.json({ connected: false });
  const creds = decryptJson<VapiSecrets>(integ.secrets) ?? {};
  // Never leak the apiKey or secret — just say whether we have one.
  return NextResponse.json({
    connected: true,
    hasApiKey: Boolean(creds.apiKey),
    assistantId: creds.assistantId ?? null,
    phoneNumberId: creds.phoneNumberId ?? null,
    firstMessage: creds.firstMessage ?? null,
    systemPrompt: creds.systemPrompt ?? null,
    voiceId: creds.voiceId ?? null,
    modelId: creds.modelId ?? null,
  });
}

export async function PATCH(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const [integ] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.tenantId, session.tenant.id), eq(integrations.provider, "vapi")))
    .limit(1);

  const current = integ?.secrets ? (decryptJson<VapiSecrets>(integ.secrets) ?? {}) : {};
  const next: VapiSecrets = { ...current };
  for (const key of [
    "apiKey",
    "assistantId",
    "phoneNumberId",
    "firstMessage",
    "systemPrompt",
    "voiceId",
    "modelId",
  ] as const) {
    if (parsed.data[key] !== undefined) {
      next[key] = parsed.data[key] || undefined;
    }
  }

  const encrypted = encryptJson(next) as unknown as Record<string, unknown>;
  if (integ) {
    await db
      .update(integrations)
      .set({
        secrets: encrypted,
        status: next.apiKey ? "connected" : "disconnected",
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integ.id));
  } else {
    await db.insert(integrations).values({
      tenantId: session.tenant.id,
      provider: "vapi",
      status: next.apiKey ? "connected" : "disconnected",
      secrets: encrypted,
    });
  }

  await recordAudit({
    tenantId: session.tenant.id,
    actorUserId: session.user.id,
    action: "integration.update",
    entityType: "integration",
    summary: "Updated Vapi assistant config",
    payload: {
      // Don't log secret material.
      assistantId: next.assistantId,
      phoneNumberId: next.phoneNumberId,
      voiceId: next.voiceId,
      modelId: next.modelId,
    },
    headers: req.headers,
  });

  return NextResponse.json({ ok: true });
}
