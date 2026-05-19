"use server";

import { db, tenants, memberships, businessProfile, type TenantRegion } from "@rosie/db";
import { revalidatePath } from "next/cache";
import { availableRegions } from "@/lib/regions";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createTenant(input: {
  userId: string;
  email: string;
  name: string;
  category: string;
  city: string;
  timezone?: string;
  region?: TenantRegion;
}) {
  const base = slugify(input.name) || "tenant";
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;

  // Validate timezone server-side before persisting.
  let tz = "UTC";
  if (input.timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
      tz = input.timezone;
    } catch {
      tz = "UTC";
    }
  }

  // Validate region against what this deployment can actually serve. Fall
  // back to "us" silently if the requested region isn't provisioned — this
  // is the right answer pre-multi-region-rollout.
  const supported = availableRegions();
  const region: TenantRegion =
    input.region && supported.includes(input.region) ? input.region : "us";

  const [tenant] = await db
    .insert(tenants)
    .values({ slug, name: input.name, timezone: tz, region })
    .returning();

  if (!tenant) throw new Error("Failed to create tenant");

  await db.insert(memberships).values({
    tenantId: tenant.id,
    userId: input.userId,
    role: "owner",
  });

  await db.insert(businessProfile).values({
    tenantId: tenant.id,
    legalName: input.name,
    email: input.email,
    category: input.category,
    address: { city: input.city, country: "US" },
  });

  revalidatePath("/");
  return { tenantId: tenant.id };
}
