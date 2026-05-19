import { NextResponse } from "next/server";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import { db, landingPages } from "@rosie/db";
import { desc, eq } from "@rosie/db";
import { loadActiveSession } from "@/lib/active-tenant";

const Body = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, and dashes only")
    .optional(),
  title: z.string().min(1).max(200),
  template: z
    .enum(["service_hero", "promo", "review_request", "lead_form"])
    .default("service_hero"),
});

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

const nano = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 6);

export const runtime = "nodejs";

export async function GET() {
  const session = await loadActiveSession();
  const rows = await db
    .select()
    .from(landingPages)
    .where(eq(landingPages.tenantId, session.tenant.id))
    .orderBy(desc(landingPages.createdAt));
  return NextResponse.json({ pages: rows });
}

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const base = parsed.data.slug ?? slugify(parsed.data.title);
  let slug = base;
  // Ensure uniqueness with a tiny suffix on collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [row] = await db
        .insert(landingPages)
        .values({
          tenantId: session.tenant.id,
          createdByUserId: session.user.id,
          slug,
          title: parsed.data.title,
          template: parsed.data.template,
          content: defaultContent(parsed.data.template, session.tenant.name),
          theme: {
            primaryColor: session.tenant.brandTheme?.primaryColor ?? "#5b21b6",
            accentColor: session.tenant.brandTheme?.accentColor ?? "#f59e0b",
          },
        })
        .returning();
      return NextResponse.json({ ok: true, page: row });
    } catch {
      slug = `${base}-${nano()}`;
    }
  }
  return NextResponse.json({ error: "could not allocate slug" }, { status: 500 });
}

function defaultContent(
  template: "service_hero" | "promo" | "review_request" | "lead_form",
  tenantName: string,
) {
  switch (template) {
    case "promo":
      return {
        headline: `Limited-time offer from ${tenantName}`,
        subhead: "Book by Friday and save.",
        ctaPrimary: { label: "Claim the offer", href: "tel:" },
        promoCode: "ROSIE10",
      };
    case "review_request":
      return {
        headline: `Help ${tenantName} keep growing`,
        subhead: "If we did right by you, a 30-second Google review goes a long way.",
        ctaPrimary: { label: "Leave a Google review", href: "" },
        reviewUrl: "",
      };
    case "lead_form":
      return {
        headline: `Get a quote from ${tenantName}`,
        subhead: "Share a few details and we'll text you back within an hour.",
        formFields: [
          { name: "name", label: "Your name", type: "text" as const, required: true },
          { name: "phone", label: "Phone", type: "tel" as const, required: true },
          { name: "email", label: "Email", type: "email" as const },
          { name: "notes", label: "What do you need?", type: "textarea" as const },
        ],
      };
    case "service_hero":
    default:
      return {
        headline: tenantName,
        subhead: "Trusted, local, and ready when you are.",
        bullets: ["Same-week service", "Professional team", "Satisfaction guaranteed"],
        ctaPrimary: { label: "Get a free quote", href: "tel:" },
        ctaSecondary: { label: "See reviews", href: "#reviews" },
      };
  }
}
