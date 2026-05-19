import { NextResponse } from "next/server";
import { z } from "zod";
import { db, landingPages } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Patch = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  content: z
    .object({
      headline: z.string().optional(),
      subhead: z.string().optional(),
      bullets: z.array(z.string()).optional(),
      ctaPrimary: z.object({ label: z.string(), href: z.string() }).optional(),
      ctaSecondary: z.object({ label: z.string(), href: z.string() }).optional(),
      heroImageUrl: z.string().optional(),
      promoCode: z.string().optional(),
      reviewUrl: z.string().optional(),
      formFields: z
        .array(
          z.object({
            name: z.string(),
            label: z.string(),
            type: z.enum(["text", "tel", "email", "textarea"]),
            required: z.boolean().optional(),
          }),
        )
        .optional(),
    })
    .partial()
    .optional(),
  theme: z
    .object({
      primaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      backgroundColor: z.string().optional(),
      logoUrl: z.string().optional(),
    })
    .partial()
    .optional(),
  campaignId: z.string().uuid().nullable().optional(),
  leadWebhookUrl: z.string().nullable().optional(),
});

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) patch[k] = v;
  }
  if (parsed.data.status === "published") {
    patch.publishedAt = new Date();
  }

  const result = await db
    .update(landingPages)
    .set(patch)
    .where(and(eq(landingPages.id, id), eq(landingPages.tenantId, session.tenant.id)))
    .returning();
  if (!result[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, page: result[0] });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  await db
    .delete(landingPages)
    .where(and(eq(landingPages.id, id), eq(landingPages.tenantId, session.tenant.id)));
  return NextResponse.json({ ok: true });
}
