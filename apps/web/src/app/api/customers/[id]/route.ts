import { NextResponse } from "next/server";
import { z } from "zod";
import { db, customers } from "@rosie/db";
import { and, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { geocodeAndStamp } from "@/lib/geocode";

export const runtime = "nodejs";

const SERVICE_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const PatchBody = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  address: z
    .object({
      street: z.string().max(200).optional(),
      city: z.string().max(120).optional(),
      region: z.string().max(120).optional(),
      postal: z.string().max(20).optional(),
      country: z.string().max(80).optional(),
    })
    .nullable()
    .optional(),
  serviceDays: z.array(z.enum(SERVICE_DAYS)).optional(),
  serviceWindow: z.string().max(60).nullable().optional(),
  zone: z.string().max(80).nullable().optional(),
  status: z.enum(["active", "paused", "cancelled"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
  pricePerVisitCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.tenantId, session.tenant.id)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ customer: row });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of [
    "name",
    "phone",
    "email",
    "serviceDays",
    "serviceWindow",
    "zone",
    "status",
    "notes",
    "pricePerVisitCents",
  ] as const) {
    if (parsed.data[k] !== undefined) update[k] = parsed.data[k];
  }
  if (parsed.data.address !== undefined) {
    update.address = parsed.data.address
      ? await geocodeAndStamp(parsed.data.address)
      : null;
  }

  const [row] = await db
    .update(customers)
    .set(update)
    .where(and(eq(customers.id, id), eq(customers.tenantId, session.tenant.id)))
    .returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, customer: row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await loadActiveSession();
  const { id } = await params;
  await db
    .delete(customers)
    .where(and(eq(customers.id, id), eq(customers.tenantId, session.tenant.id)));
  return NextResponse.json({ ok: true });
}
