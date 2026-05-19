import { NextResponse } from "next/server";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import QRCode from "qrcode";
import { headers } from "next/headers";
import {
  db,
  posts,
  landingPages,
  qrCodes,
  bulkMessages,
} from "@rosie/db";
import { draftPost, type PostPlatform } from "@rosie/ai";
import { loadActiveSession } from "@/lib/active-tenant";
import { uploadPublic } from "@/lib/supabase/admin";
import { checkBudget, recordLlmUsage } from "@/lib/usage";

const Body = z.object({
  template: z.enum(["promo", "seasonal", "review_drive", "new_service"]),
  topic: z.string().max(300).optional(),
  /** Optional bulk-message body. If provided, a draft bulk message is created (not sent). */
  bulkBody: z.string().max(1000).optional(),
});

const nano = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789", 10);

async function origin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const runtime = "nodejs";
export const maxDuration = 90;

const TEMPLATE_META: Record<
  string,
  { name: string; landingTemplate: "service_hero" | "promo" | "review_request" | "lead_form"; defaultBulk: string; postTopic: string }
> = {
  promo: {
    name: "Promo campaign",
    landingTemplate: "promo",
    defaultBulk: "Hey! Quick heads up — we're running a limited promo this week. Want to grab it?",
    postTopic: "current promo (limited-time savings, ends Friday)",
  },
  seasonal: {
    name: "Seasonal campaign",
    landingTemplate: "service_hero",
    defaultBulk: "Quick season-specific reminder — anything you'd like us to handle this round?",
    postTopic: "seasonal kickoff — first jobs of the season",
  },
  review_drive: {
    name: "Review drive",
    landingTemplate: "review_request",
    defaultBulk: "Hi! If we did right by you, a 30-second Google review would mean the world. Link in our last text or {{REVIEW_URL}}.",
    postTopic: "thanking customers who left reviews and inviting more",
  },
  new_service: {
    name: "New service launch",
    landingTemplate: "service_hero",
    defaultBulk: "Just launched a new service we think you'll love — interested?",
    postTopic: "new service we just added — first-week pricing",
  },
};

export async function POST(req: Request) {
  const session = await loadActiveSession();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const meta = TEMPLATE_META[parsed.data.template];
  if (!meta) return NextResponse.json({ error: "unknown template" }, { status: 400 });

  const verdict = await checkBudget({ tenantId: session.tenant.id, kind: "llm" });
  if (!verdict.allowed) {
    return NextResponse.json({ error: verdict.reason }, { status: 402 });
  }

  const ctx = {
    tenantName: session.tenant.name,
    category: session.profile?.category ?? undefined,
    city: session.profile?.address?.city ?? undefined,
    services: session.profile?.services ?? undefined,
  };

  // 1) Draft an FB post.
  const draft = await draftPost({
    context: ctx,
    voice: session.profile?.brandVoice ?? undefined,
    platform: "facebook" as PostPlatform,
    topic: parsed.data.topic ?? meta.postTopic,
  });
  if (draft.usage) {
    await recordLlmUsage(
      session.tenant.id,
      draft.usage.model,
      draft.usage.inputTokens,
      draft.usage.outputTokens,
      "quick_launch",
    );
  }
  const [post] = await db
    .insert(posts)
    .values({
      tenantId: session.tenant.id,
      createdByUserId: session.user.id,
      platform: "facebook",
      status: "draft",
      body: draft.body,
      title: draft.title,
      brandVoiceSnapshot: session.profile?.brandVoice ?? null,
      aiMeta: { source: "quick_launch", template: parsed.data.template },
    })
    .returning({ id: posts.id });

  // 2) Create a landing page draft.
  const slug = `launch-${parsed.data.template}-${nano().toLowerCase().slice(0, 6)}`;
  const [page] = await db
    .insert(landingPages)
    .values({
      tenantId: session.tenant.id,
      createdByUserId: session.user.id,
      slug,
      title: `${meta.name} — ${session.tenant.name}`,
      template: meta.landingTemplate,
      status: "draft",
      content: {
        headline: `${meta.name} from ${session.tenant.name}`,
        subhead: parsed.data.topic ?? meta.postTopic,
        ctaPrimary: { label: "Get started", href: "tel:" },
      },
      theme: {
        primaryColor: session.tenant.brandTheme?.primaryColor ?? "#5b21b6",
        accentColor: session.tenant.brandTheme?.accentColor ?? "#f59e0b",
      },
    })
    .returning({ id: landingPages.id, slug: landingPages.slug });

  // 3) Generate a tracked QR that points at the landing page.
  const base = await origin();
  let qrId: string | null = null;
  try {
    const code = nano();
    const trackingUrl = `${base}/q/${code}`;
    const png = await QRCode.toBuffer(trackingUrl, {
      type: "png",
      errorCorrectionLevel: "H",
      margin: 2,
      width: 600,
      color: {
        dark: session.tenant.brandTheme?.primaryColor ?? "#0b0b14",
        light: "#ffffff",
      },
    });
    const storagePath = `${session.tenant.id}/${code}.png`;
    await uploadPublic("qr", storagePath, png, "image/png");
    const [qr] = await db
      .insert(qrCodes)
      .values({
        tenantId: session.tenant.id,
        createdByUserId: session.user.id,
        code,
        name: `${meta.name} QR`,
        destinationUrl: `${base}/p/${page!.slug}`,
        storagePath,
        style: { color: session.tenant.brandTheme?.primaryColor },
      })
      .returning({ id: qrCodes.id });
    qrId = qr?.id ?? null;
  } catch (e) {
    console.error("quick-launch QR failed", e);
  }

  // 4) Draft a bulk message (do not send).
  const [bulk] = await db
    .insert(bulkMessages)
    .values({
      tenantId: session.tenant.id,
      createdByUserId: session.user.id,
      name: `${meta.name} blast`,
      body: parsed.data.bulkBody ?? meta.defaultBulk,
      status: "draft",
      filter: { stages: ["won"], commercial: "any" },
    })
    .returning({ id: bulkMessages.id });

  return NextResponse.json({
    ok: true,
    template: parsed.data.template,
    artifacts: {
      postId: post?.id,
      landingPageId: page?.id,
      landingSlug: page?.slug,
      qrCodeId: qrId,
      bulkMessageId: bulk?.id,
    },
  });
}
