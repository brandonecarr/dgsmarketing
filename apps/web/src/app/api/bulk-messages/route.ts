import { NextResponse } from "next/server";
import { z } from "zod";
import { db, bulkMessages } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { previewBulkRecipients } from "@/lib/bulk-messages/recipients";

const Filter = z.object({
  stages: z.array(z.string()).optional(),
  source: z.array(z.string()).optional(),
  createdWithinDays: z.number().int().min(1).max(365).optional(),
  noOutboundForDays: z.number().int().min(1).max(365).optional(),
  commercial: z.enum(["only", "exclude", "any"]).optional(),
});

const Body = z.object({
  name: z.string().min(1).max(120),
  body: z.string().min(1).max(1600),
  filter: Filter.optional(),
  scheduledFor: z.string().datetime().optional(),
});

export const runtime = "nodejs";

export async function GET() {
  const session = await loadActiveSession();
  const rows = await db
    .select()
    .from(bulkMessages)
    .where(eq(bulkMessages.tenantId, session.tenant.id))
    .orderBy(desc(bulkMessages.createdAt));
  return NextResponse.json({ bulkMessages: rows });
}

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const preview = await previewBulkRecipients(session.tenant.id, parsed.data.filter);
  const [row] = await db
    .insert(bulkMessages)
    .values({
      tenantId: session.tenant.id,
      createdByUserId: session.user.id,
      name: parsed.data.name,
      body: parsed.data.body,
      filter: parsed.data.filter,
      status: parsed.data.scheduledFor ? "scheduled" : "draft",
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null,
      recipientCount: preview.length.toString(),
    })
    .returning();

  return NextResponse.json({ ok: true, bulkMessage: row, previewCount: preview.length });
}
