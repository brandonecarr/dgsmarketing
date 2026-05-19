import {
  db,
  leads,
  conversations,
  messages,
  actions,
  posts,
  integrations,
  adCampaigns,
  adMetricsDaily,
  STAGE_ORDER,
} from "@rosie/db";
import { and, desc, eq, gte, isNull, lt, or, sql } from "@rosie/db";
import { setCampaignStatus } from "@/lib/ads/actions";
import { suggestReply, draftPost, type RosieContext } from "@rosie/ai";
import { getProvider } from "@rosie/messaging";
import type { AgentToolInvocation, AgentToolResult } from "@rosie/ai";
import { recordUsage } from "@/lib/usage";
import { decryptJson } from "@/lib/crypto";
import { isOptedOut } from "@/lib/compliance/sms";

interface DispatchCtx {
  tenantId: string;
  userId: string;
  rosie: RosieContext;
  brandVoice: import("@rosie/ai").BrandVoice | undefined;
  /** Each tool call appends one row here. */
  recordRun: (input: {
    ruleName: string;
    status: "success" | "failed" | "skipped";
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    diff?: Record<string, unknown>;
    error?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    actionId?: string;
    undoable?: boolean;
    durationMs?: number;
  }) => Promise<string>;
}

type ToolName = string;
type ToolFn = (
  ctx: DispatchCtx,
  input: Record<string, unknown>,
) => Promise<AgentToolResult>;

function err(message: string): AgentToolResult {
  return { kind: "error", message };
}

const TOOLS: Record<ToolName, ToolFn> = {
  async read_pipeline_summary(ctx) {
    const start = Date.now();
    const counts = await db
      .select({ stage: leads.stage, count: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.tenantId, ctx.tenantId))
      .groupBy(leads.stage);

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stale = await db
      .select({ stage: leads.stage, count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, ctx.tenantId),
          or(isNull(leads.lastMessageAt), lt(leads.lastMessageAt, oneDayAgo)),
        ),
      )
      .groupBy(leads.stage);

    const result = STAGE_ORDER.map((s) => ({
      stage: s,
      total: counts.find((c) => c.stage === s)?.count ?? 0,
      staleOverDay: stale.find((c) => c.stage === s)?.count ?? 0,
    }));

    await ctx.recordRun({
      ruleName: "tool:read_pipeline_summary",
      status: "success",
      outputs: { result },
      durationMs: Date.now() - start,
    });
    return { kind: "ok", content: { stages: result } };
  },

  async read_open_conversations(ctx, input) {
    const start = Date.now();
    const limit = Math.min(typeof input.limit === "number" ? input.limit : 10, 25);
    const stage = typeof input.stage === "string" ? input.stage : null;

    const rows = await db
      .select({
        conversationId: conversations.id,
        leadId: conversations.leadId,
        leadName: leads.name,
        leadPhone: leads.phone,
        leadStage: leads.stage,
        score: leads.score,
        lastMessagePreview: conversations.lastMessagePreview,
        lastMessageAt: conversations.lastMessageAt,
      })
      .from(conversations)
      .leftJoin(leads, eq(leads.id, conversations.leadId))
      .where(
        stage && (STAGE_ORDER as readonly string[]).includes(stage)
          ? and(
              eq(conversations.tenantId, ctx.tenantId),
              eq(leads.stage, stage as (typeof STAGE_ORDER)[number]),
            )
          : eq(conversations.tenantId, ctx.tenantId),
      )
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit);

    const now = Date.now();
    const conversationsOut = rows.map((r) => ({
      conversationId: r.conversationId,
      leadId: r.leadId,
      leadName: r.leadName,
      leadPhone: r.leadPhone,
      stage: r.leadStage,
      score: r.score,
      lastMessagePreview: r.lastMessagePreview,
      hoursSinceLastMessage: r.lastMessageAt
        ? Math.round((now - r.lastMessageAt.getTime()) / (60 * 60 * 1000))
        : null,
    }));

    await ctx.recordRun({
      ruleName: "tool:read_open_conversations",
      status: "success",
      inputs: input,
      outputs: { count: rows.length },
      durationMs: Date.now() - start,
    });
    return { kind: "ok", content: { conversations: conversationsOut } };
  },

  async read_lead(ctx, input) {
    const start = Date.now();
    const leadId = String(input.leadId);
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);
    if (!lead) return err("Lead not found");

    const conv = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.leadId, leadId))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(1);

    const msgs = conv[0]
      ? await db
          .select({
            direction: messages.direction,
            body: messages.body,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.conversationId, conv[0].id))
          .orderBy(messages.createdAt)
          .limit(30)
      : [];

    const result = {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      stage: lead.stage,
      score: lead.score,
      source: lead.source,
      metadata: lead.metadata,
      attribution: lead.attribution,
      firstContactAt: lead.firstContactAt,
      lastMessageAt: lead.lastMessageAt,
      thread: msgs.map((m) => ({
        direction: m.direction,
        body: m.body,
        at: m.createdAt.toISOString(),
      })),
    };

    await ctx.recordRun({
      ruleName: "tool:read_lead",
      status: "success",
      inputs: input,
      outputs: { stage: lead.stage, messageCount: msgs.length },
      relatedEntityType: "lead",
      relatedEntityId: lead.id,
      durationMs: Date.now() - start,
    });
    return { kind: "ok", content: result };
  },

  async draft_sms_reply(ctx, input) {
    const start = Date.now();
    const conversationId = String(input.conversationId);
    const [conv] = await db
      .select()
      .from(conversations)
      .where(
        and(eq(conversations.id, conversationId), eq(conversations.tenantId, ctx.tenantId)),
      )
      .limit(1);
    if (!conv) return err("Conversation not found");

    const history = await db
      .select({ direction: messages.direction, body: messages.body })
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(messages.createdAt)
      .limit(40);

    let leadMeta: Record<string, unknown> | undefined;
    if (conv.leadId) {
      const [lead] = await db.select().from(leads).where(eq(leads.id, conv.leadId)).limit(1);
      if (lead) {
        leadMeta = {
          name: lead.name,
          stage: lead.stage,
          ...(lead.metadata ?? {}),
        };
      }
    }

    const out = await suggestReply({
      context: ctx.rosie,
      history,
      leadMeta,
      instruction: typeof input.instruction === "string" ? input.instruction : undefined,
    });

    await ctx.recordRun({
      ruleName: "tool:draft_sms_reply",
      status: "success",
      inputs: { conversationId },
      outputs: { reply: out.reply, reasoning: out.reasoning },
      relatedEntityType: "conversation",
      relatedEntityId: conv.id,
      durationMs: Date.now() - start,
    });
    return { kind: "ok", content: { reply: out.reply, reasoning: out.reasoning } };
  },

  async send_sms(ctx, input) {
    const start = Date.now();
    const conversationId = String(input.conversationId);
    const body = String(input.body).slice(0, 320);
    const reason = String(input.reason ?? "agent");

    const [conv] = await db
      .select()
      .from(conversations)
      .where(
        and(eq(conversations.id, conversationId), eq(conversations.tenantId, ctx.tenantId)),
      )
      .limit(1);
    if (!conv) return err("Conversation not found");
    if (!conv.participantPhone) return err("Conversation has no phone number to send to");
    if (await isOptedOut(ctx.tenantId, conv.participantPhone)) {
      return err(
        "This number has opted out of SMS (TCPA). Use create_action with a follow-up plan instead.",
      );
    }

    const [integ] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, ctx.tenantId),
          eq(integrations.provider, conv.provider as "quo" | "openphone"),
        ),
      )
      .limit(1);
    const creds =
      decryptJson<{ apiKey?: string; fromId?: string; fromNumber?: string }>(integ?.secrets) ??
      {};
    let externalId: string | null = null;
    let sentAt = new Date();
    let dryRun = false;

    if (creds.apiKey) {
      try {
        const provider = getProvider(conv.provider as "quo" | "openphone");
        const sent = await provider.sendSms(
          { to: conv.participantPhone, body },
          { apiKey: creds.apiKey, fromId: creds.fromId, fromNumber: creds.fromNumber },
        );
        externalId = sent.externalId;
        sentAt = sent.sentAt;
      } catch (e) {
        await ctx.recordRun({
          ruleName: "tool:send_sms",
          status: "failed",
          inputs: { conversationId, body, reason },
          error: e instanceof Error ? e.message : String(e),
          durationMs: Date.now() - start,
        });
        return err(`Send failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      dryRun = true;
    }

    const [msg] = await db
      .insert(messages)
      .values({
        tenantId: ctx.tenantId,
        conversationId: conv.id,
        direction: "outbound",
        senderType: "rosie",
        body,
        externalId,
        deliveredAt: sentAt,
      })
      .returning({ id: messages.id });

    await db
      .update(conversations)
      .set({
        lastMessageAt: sentAt,
        lastMessagePreview: body.slice(0, 140),
        unreadCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conv.id));

    if (conv.leadId) {
      await db
        .update(leads)
        .set({
          lastMessageAt: sentAt,
          stage: sql`case when ${leads.stage} = 'new' then 'engaged'::lead_stage else ${leads.stage} end`,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, conv.leadId));
    }

    await ctx.recordRun({
      ruleName: "tool:send_sms",
      status: "success",
      inputs: { conversationId, body, reason, dryRun },
      outputs: { messageId: msg?.id, externalId, dryRun },
      relatedEntityType: "conversation",
      relatedEntityId: conv.id,
      undoable: true,
      diff: { undoKind: "delete_message", messageId: msg?.id },
      durationMs: Date.now() - start,
    });
    await recordUsage({
      tenantId: ctx.tenantId,
      kind: "sms_sent",
      units: 1,
      costUsd: dryRun ? 0 : Number(process.env.ROSIE_SMS_UNIT_COST_USD ?? 0.01),
      source: "agent_send",
      meta: { dryRun, conversationId },
    });
    return {
      kind: "ok",
      content: { messageId: msg?.id, dryRun, sentAt: sentAt.toISOString() },
    };
  },

  async advance_lead_stage(ctx, input) {
    const start = Date.now();
    const leadId = String(input.leadId);
    const toStage = String(input.toStage) as (typeof STAGE_ORDER)[number];
    if (!(STAGE_ORDER as readonly string[]).includes(toStage))
      return err(`Unknown stage ${toStage}`);

    const [before] = await db
      .select({ stage: leads.stage })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);
    if (!before) return err("Lead not found");

    const now = new Date();
    const patch: Record<string, unknown> = { stage: toStage, updatedAt: now };
    if (toStage === "won") patch.wonAt = now;
    if (toStage === "lost") patch.lostAt = now;

    await db
      .update(leads)
      .set(patch)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, ctx.tenantId)));

    await ctx.recordRun({
      ruleName: "tool:advance_lead_stage",
      status: "success",
      inputs: { leadId, toStage, reason: input.reason },
      outputs: { from: before.stage, to: toStage },
      relatedEntityType: "lead",
      relatedEntityId: leadId,
      undoable: true,
      diff: { undoKind: "lead_stage", leadId, fromStage: before.stage },
      durationMs: Date.now() - start,
    });
    return {
      kind: "ok",
      content: { from: before.stage, to: toStage },
    };
  },

  async create_action(ctx, input) {
    const start = Date.now();
    const title = String(input.title).slice(0, 140);
    const body = String(input.body ?? "").slice(0, 1000);
    const priority = Math.max(1, Math.min(10, Math.round(Number(input.priority ?? 5))));
    const relatedEntityType =
      typeof input.relatedEntityType === "string" ? input.relatedEntityType : undefined;
    const relatedEntityId =
      typeof input.relatedEntityId === "string" ? input.relatedEntityId : undefined;

    const [row] = await db
      .insert(actions)
      .values({
        tenantId: ctx.tenantId,
        source: "rosie_suggestion",
        title,
        body,
        priority,
        relatedEntityType,
        relatedEntityId,
      })
      .returning({ id: actions.id });

    await ctx.recordRun({
      ruleName: "tool:create_action",
      status: "success",
      inputs: input,
      outputs: { actionId: row?.id },
      relatedEntityType: relatedEntityType ?? undefined,
      relatedEntityId: relatedEntityId ?? undefined,
      actionId: row?.id,
      undoable: true,
      diff: { undoKind: "delete_action", actionId: row?.id },
      durationMs: Date.now() - start,
    });
    return { kind: "ok", content: { actionId: row?.id } };
  },

  async draft_post(ctx, input) {
    const start = Date.now();
    const platform = String(input.platform) as
      | "facebook"
      | "instagram"
      | "google_business"
      | "linkedin"
      | "tiktok";
    const result = await draftPost({
      context: ctx.rosie,
      voice: ctx.brandVoice,
      platform,
      topic: typeof input.topic === "string" ? input.topic : undefined,
      characterName: typeof input.characterName === "string" ? input.characterName : undefined,
    });
    const [row] = await db
      .insert(posts)
      .values({
        tenantId: ctx.tenantId,
        createdByUserId: ctx.userId,
        platform,
        body: result.body,
        title: result.title,
        status: "draft",
        brandVoiceSnapshot: ctx.brandVoice ?? null,
        aiMeta: { source: "agent", topic: input.topic, characterName: input.characterName },
      })
      .returning({ id: posts.id });

    await ctx.recordRun({
      ruleName: "tool:draft_post",
      status: "success",
      inputs: input,
      outputs: { postId: row?.id, preview: result.body.slice(0, 200) },
      undoable: true,
      diff: { undoKind: "delete_post", postId: row?.id },
      durationMs: Date.now() - start,
    });
    return { kind: "ok", content: { postId: row?.id, preview: result.body.slice(0, 200) } };
  },

  async request_review_for_lead(ctx, input) {
    const start = Date.now();
    const leadId = String(input.leadId);
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);
    if (!lead) return err("Lead not found");
    if (lead.stage !== "won") return err("Lead is not Won yet");
    const display = lead.name?.split(" ")[0] ?? "there";
    const draft = `Hi ${display}! Thanks again for choosing us. If you have a sec, a quick Google review goes a long way — here's the link: {{REVIEW_URL}}. Appreciate you!`;

    const [row] = await db
      .insert(actions)
      .values({
        tenantId: ctx.tenantId,
        source: "rule_review_after_won",
        title: `Ask ${lead.name ?? lead.phone ?? "Won customer"} for a Google review`,
        body: "Rosie prepared the SMS below. Paste your Google review link into the placeholder and send.",
        priority: 3,
        relatedEntityType: "lead",
        relatedEntityId: lead.id,
        metadata: { leadId: lead.id, phone: lead.phone, draftMessage: draft },
      })
      .returning({ id: actions.id });

    await ctx.recordRun({
      ruleName: "tool:request_review_for_lead",
      status: "success",
      inputs: { leadId },
      outputs: { actionId: row?.id },
      relatedEntityType: "lead",
      relatedEntityId: lead.id,
      actionId: row?.id,
      undoable: true,
      diff: { undoKind: "delete_action", actionId: row?.id },
      durationMs: Date.now() - start,
    });
    return { kind: "ok", content: { actionId: row?.id } };
  },

  async list_ad_campaigns(ctx, input) {
    const start = Date.now();
    const platform = typeof input.platform === "string" ? input.platform : null;
    const status = typeof input.status === "string" ? input.status : "any";

    let baseWhere = eq(adCampaigns.tenantId, ctx.tenantId);
    if (platform === "meta" || platform === "google_ads" || platform === "tiktok") {
      baseWhere = and(baseWhere, eq(adCampaigns.platform, platform))!;
    }
    if (status === "active" || status === "paused") {
      baseWhere = and(baseWhere, eq(adCampaigns.status, status))!;
    }

    const rows = await db
      .select({
        id: adCampaigns.id,
        platform: adCampaigns.platform,
        name: adCampaigns.name,
        status: adCampaigns.status,
        dailyBudget: adCampaigns.dailyBudget,
      })
      .from(adCampaigns)
      .where(baseWhere)
      .limit(50);

    // Roll up last-30d metrics per campaign.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const metricRows = await db
      .select({
        campaignId: adMetricsDaily.campaignId,
        spend: sql<string>`coalesce(sum(${adMetricsDaily.spendUsd}), 0)::text`,
        impressions: sql<number>`coalesce(sum(${adMetricsDaily.impressions}), 0)::int`,
        clicks: sql<number>`coalesce(sum(${adMetricsDaily.clicks}), 0)::int`,
        conversions: sql<number>`coalesce(sum(${adMetricsDaily.conversions}), 0)::int`,
      })
      .from(adMetricsDaily)
      .where(
        and(
          eq(adMetricsDaily.tenantId, ctx.tenantId),
          gte(adMetricsDaily.date, since),
        ),
      )
      .groupBy(adMetricsDaily.campaignId);

    const byId = new Map(metricRows.map((m) => [m.campaignId, m]));

    const result = rows.map((r) => {
      const m = byId.get(r.id);
      return {
        id: r.id,
        platform: r.platform,
        name: r.name,
        status: r.status,
        dailyBudget: r.dailyBudget,
        last30d: {
          spendUsd: m ? Number(m.spend) : 0,
          impressions: m?.impressions ?? 0,
          clicks: m?.clicks ?? 0,
          conversions: m?.conversions ?? 0,
        },
      };
    });

    await ctx.recordRun({
      ruleName: "tool:list_ad_campaigns",
      status: "success",
      inputs: input,
      outputs: { count: result.length },
      durationMs: Date.now() - start,
    });
    return { kind: "ok", content: { campaigns: result } };
  },

  async pause_campaign(ctx, input) {
    const start = Date.now();
    const campaignId = String(input.campaignId);
    const reason = String(input.reason);
    const result = await setCampaignStatus({
      tenantId: ctx.tenantId,
      campaignRowId: campaignId,
      target: "paused",
    });
    await ctx.recordRun({
      ruleName: "tool:pause_campaign",
      status: result.ok ? "success" : "failed",
      inputs: { campaignId, reason },
      outputs: { ...result },
      relatedEntityType: "campaign",
      relatedEntityId: campaignId,
      undoable: result.ok && result.fromStatus === "active",
      diff:
        result.ok && result.fromStatus === "active"
          ? { undoKind: "ad_campaign_status", campaignRowId: campaignId, restoreTo: "active" }
          : undefined,
      error: result.ok ? undefined : result.error,
      durationMs: Date.now() - start,
    });
    return result.ok
      ? { kind: "ok", content: result }
      : err(result.error ?? "pause failed");
  },

  async resume_campaign(ctx, input) {
    const start = Date.now();
    const campaignId = String(input.campaignId);
    const reason = String(input.reason);
    const result = await setCampaignStatus({
      tenantId: ctx.tenantId,
      campaignRowId: campaignId,
      target: "active",
    });
    await ctx.recordRun({
      ruleName: "tool:resume_campaign",
      status: result.ok ? "success" : "failed",
      inputs: { campaignId, reason },
      outputs: { ...result },
      relatedEntityType: "campaign",
      relatedEntityId: campaignId,
      undoable: result.ok && result.fromStatus === "paused",
      diff:
        result.ok && result.fromStatus === "paused"
          ? { undoKind: "ad_campaign_status", campaignRowId: campaignId, restoreTo: "paused" }
          : undefined,
      error: result.ok ? undefined : result.error,
      durationMs: Date.now() - start,
    });
    return result.ok
      ? { kind: "ok", content: result }
      : err(result.error ?? "resume failed");
  },
};

export async function dispatchTool(
  ctx: DispatchCtx,
  call: AgentToolInvocation,
): Promise<AgentToolResult> {
  const fn = TOOLS[call.name];
  if (!fn) {
    return err(`Unknown tool: ${call.name}`);
  }
  try {
    return await fn(ctx, call.input);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await ctx.recordRun({
      ruleName: `tool:${call.name}`,
      status: "failed",
      inputs: call.input,
      error: message,
    });
    return err(message);
  }
}

/** Helper used by /api/auto-rosie/undo/[token]. */
export async function undoRunDiff(
  tenantId: string,
  diff: Record<string, unknown>,
): Promise<{ ok: boolean; detail?: string }> {
  const kind = diff.undoKind;
  if (kind === "lead_stage") {
    const leadId = String(diff.leadId);
    const fromStage = diff.fromStage as (typeof STAGE_ORDER)[number] | undefined;
    if (!fromStage) return { ok: false, detail: "missing fromStage" };
    await db
      .update(leads)
      .set({
        stage: fromStage,
        wonAt: fromStage === "won" ? new Date() : null,
        lostAt: fromStage === "lost" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)));
    return { ok: true };
  }
  if (kind === "delete_action") {
    const actionId = String(diff.actionId);
    await db
      .update(actions)
      .set({ status: "dismissed", updatedAt: new Date() })
      .where(and(eq(actions.id, actionId), eq(actions.tenantId, tenantId)));
    return { ok: true };
  }
  if (kind === "delete_post") {
    const postId = String(diff.postId);
    await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.tenantId, tenantId)));
    return { ok: true };
  }
  if (kind === "delete_message") {
    const messageId = String(diff.messageId);
    await db
      .delete(messages)
      .where(and(eq(messages.id, messageId), eq(messages.tenantId, tenantId)));
    return { ok: true };
  }
  if (kind === "ad_campaign_status") {
    const campaignRowId = String(diff.campaignRowId);
    const restoreTo = diff.restoreTo === "paused" ? "paused" : "active";
    const result = await setCampaignStatus({
      tenantId,
      campaignRowId,
      target: restoreTo,
    });
    return result.ok ? { ok: true } : { ok: false, detail: result.error };
  }
  return { ok: false, detail: `unknown undoKind: ${kind}` };
}
