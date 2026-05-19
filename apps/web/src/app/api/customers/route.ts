import { NextResponse } from "next/server";
import { z } from "zod";
import { db, customers } from "@rosie/db";
import { and, desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";
import { geocodeAndStamp } from "@/lib/geocode";

export const runtime = "nodejs";

const SERVICE_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const AddressInput = z
  .object({
    street: z.string().max(200).optional(),
    city: z.string().max(120).optional(),
    region: z.string().max(120).optional(),
    postal: z.string().max(20).optional(),
    country: z.string().max(80).optional(),
  })
  .optional();

const CreateBody = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(200).optional(),
  address: AddressInput,
  serviceDays: z.array(z.enum(SERVICE_DAYS)).default([]),
  serviceWindow: z.string().max(60).optional(),
  zone: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
  pricePerVisitCents: z.number().int().min(0).max(10_000_000).optional(),
  leadId: z.string().uuid().optional(),
});

export async function GET(req: Request) {
  const session = await loadActiveSession();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const where = status
    ? and(
        eq(customers.tenantId, session.tenant.id),
        eq(customers.status, status as "active" | "paused" | "cancelled"),
      )
    : eq(customers.tenantId, session.tenant.id);

  const rows = await db
    .select()
    .from(customers)
    .where(where)
    .orderBy(desc(customers.updatedAt))
    .limit(500);
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const address = parsed.data.address
    ? await geocodeAndStamp(parsed.data.address)
    : undefined;

  const [row] = await db
    .insert(customers)
    .values({
      tenantId: session.tenant.id,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      address,
      serviceDays: parsed.data.serviceDays,
      serviceWindow: parsed.data.serviceWindow,
      zone: parsed.data.zone,
      notes: parsed.data.notes,
      pricePerVisitCents: parsed.data.pricePerVisitCents,
      leadId: parsed.data.leadId,
      serviceSince: new Date(),
    })
    .returning();
  return NextResponse.json({ ok: true, customer: row });
}
