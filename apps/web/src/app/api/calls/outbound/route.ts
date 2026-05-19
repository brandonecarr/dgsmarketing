import { NextResponse } from "next/server";
import { z } from "zod";
import { db, integrations, leads, calls } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { placeOutboundCall, VapiError } from "@/lib/vapi/client";
import { decryptJson } from "@/lib/crypto";

const Body = z.object({
  toNumber: z.string().min(7).max(20),
  leadId: z.string().uuid().optional(),
  firstMessage: z.string().max(800).optional(),
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const [integ] = await db
    .select()
    .from(integrations)
    .where(
      and(eq(integrations.tenantId, session.tenant.id), eq(integrations.provider, "vapi")),
    )
    .limit(1);
  if (!integ?.secrets) {
    return NextResponse.json({ error: "Vapi not connected" }, { status: 412 });
  }
  const creds =
    decryptJson<{ apiKey?: string; assistantId?: string; phoneNumberId?: string }>(
      integ.secrets,
    ) ?? {};
  if (!creds.apiKey) return NextResponse.json({ error: "Vapi apiKey missing" }, { status: 412 });

  // Verify lead belongs to this tenant when leadId provided.
  if (parsed.data.leadId) {
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, parsed.data.leadId), eq(leads.tenantId, session.tenant.id)))
      .limit(1);
    if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });
  }

  try {
    const result = await placeOutboundCall(
      {
        apiKey: creds.apiKey,
        assistantId: creds.assistantId,
        phoneNumberId: creds.phoneNumberId,
      },
      {
        toNumber: parsed.data.toNumber,
        firstMessage: parsed.data.firstMessage,
        metadata: { rosieTenantId: session.tenant.id, leadId: parsed.data.leadId },
      },
    );
    await db.insert(calls).values({
      tenantId: session.tenant.id,
      leadId: parsed.data.leadId,
      externalId: result.id,
      provider: "vapi",
      direction: "outbound",
      toNumber: parsed.data.toNumber,
      status: "queued",
    });
    return NextResponse.json({ ok: true, callId: result.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "call failed" },
      { status: e instanceof VapiError ? e.status ?? 502 : 502 },
    );
  }
}
