import type { AgentTool } from "@rosie/ai";

export const STAGES = ["new", "engaged", "quoted", "qualified", "booked", "won", "lost"] as const;

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "list_ad_campaigns",
    description:
      "List ad campaigns across connected platforms (Meta / Google Ads / TikTok). Returns Rosie's internal campaign id (use this with pause_campaign / resume_campaign), platform, name, status, daily budget, and 30-day spend/impressions/clicks/conversions.",
    input_schema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["meta", "google_ads", "tiktok"] },
        status: { type: "string", enum: ["active", "paused", "any"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "pause_campaign",
    description:
      "Pause a campaign on its underlying ad platform. Use after confirming low/zero conversion via list_ad_campaigns. Records an auditable, undoable run.",
    input_schema: {
      type: "object",
      properties: {
        campaignId: {
          type: "string",
          format: "uuid",
          description: "Rosie internal id from list_ad_campaigns.",
        },
        reason: { type: "string" },
      },
      required: ["campaignId", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "resume_campaign",
    description: "Resume a paused campaign. Same input shape as pause_campaign. Use sparingly.",
    input_schema: {
      type: "object",
      properties: {
        campaignId: { type: "string", format: "uuid" },
        reason: { type: "string" },
      },
      required: ["campaignId", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "read_pipeline_summary",
    description:
      "Counts of leads per stage plus the count of leads that have been sitting in each stage for over 24 hours with no outbound reply. Always call this first.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_open_conversations",
    description:
      "Returns the latest open SMS conversations (id, lead name, phone, stage, last inbound preview, hours since last contact, predictive score if any). Optionally filter by stage.",
    input_schema: {
      type: "object",
      properties: {
        stage: { type: "string", enum: [...STAGES] },
        limit: { type: "number", minimum: 1, maximum: 25 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "read_lead",
    description:
      "Full detail for a single lead: stage, contact info, full message thread, attribution, and score.",
    input_schema: {
      type: "object",
      properties: { leadId: { type: "string", format: "uuid" } },
      required: ["leadId"],
      additionalProperties: false,
    },
  },
  {
    name: "draft_sms_reply",
    description:
      "Generate a short SMS reply for a conversation in the business's brand voice. Returns the draft text. Does NOT send.",
    input_schema: {
      type: "object",
      properties: {
        conversationId: { type: "string", format: "uuid" },
        instruction: { type: "string", description: "Optional steer." },
      },
      required: ["conversationId"],
      additionalProperties: false,
    },
  },
  {
    name: "send_sms",
    description:
      "Send an SMS on a conversation. Use ONLY after you have a draft (or operator instruction) and a concrete reason. The body is the exact text that will go out.",
    input_schema: {
      type: "object",
      properties: {
        conversationId: { type: "string", format: "uuid" },
        body: { type: "string", maxLength: 320 },
        reason: { type: "string", description: "One-line why-now." },
      },
      required: ["conversationId", "body", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "advance_lead_stage",
    description:
      "Move a lead to a new pipeline stage. Use only when context is unambiguous. Records a reverseable audit row.",
    input_schema: {
      type: "object",
      properties: {
        leadId: { type: "string", format: "uuid" },
        toStage: { type: "string", enum: [...STAGES] },
        reason: { type: "string" },
      },
      required: ["leadId", "toStage", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "create_action",
    description:
      "Add an Action Plan item for the operator to review. Use when the right move requires human judgment.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", maxLength: 140 },
        body: { type: "string", maxLength: 1000 },
        priority: { type: "number", minimum: 1, maximum: 10 },
        relatedEntityType: { type: "string", enum: ["lead", "conversation", "post", "campaign"] },
        relatedEntityId: { type: "string", format: "uuid" },
      },
      required: ["title", "body", "priority"],
      additionalProperties: false,
    },
  },
  {
    name: "draft_post",
    description:
      "Draft an organic social post for the brand and save it as a draft. Use for thinking-out-loud, hero stories, route notes, etc.",
    input_schema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["facebook", "instagram", "google_business", "linkedin", "tiktok"],
        },
        topic: { type: "string" },
        characterName: { type: "string" },
      },
      required: ["platform"],
      additionalProperties: false,
    },
  },
  {
    name: "request_review_for_lead",
    description:
      "Create a review-request Action Plan item for a Won lead with a pre-drafted SMS. Does not send the SMS.",
    input_schema: {
      type: "object",
      properties: { leadId: { type: "string", format: "uuid" } },
      required: ["leadId"],
      additionalProperties: false,
    },
  },
];
