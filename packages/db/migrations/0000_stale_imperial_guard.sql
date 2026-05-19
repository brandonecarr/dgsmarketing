CREATE TYPE "public"."tenant_region" AS ENUM('us', 'eu', 'au');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'operator', 'staff', 'client');--> statement-breakpoint
CREATE TYPE "public"."rosie_message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('sms_inbound', 'fb_lead_form', 'web_form', 'make_webhook', 'manual', 'import');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('new', 'engaged', 'quoted', 'qualified', 'booked', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."conversation_channel" AS ENUM('sms', 'email', 'call', 'fb_dm', 'ig_dm');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."messaging_provider" AS ENUM('quo', 'openphone', 'twilio', 'fb_messenger', 'manual');--> statement-breakpoint
CREATE TYPE "public"."message_sender_type" AS ENUM('lead', 'operator', 'rosie', 'system');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('quo', 'openphone', 'google', 'google_ads', 'meta', 'tiktok', 'make', 'stripe', 'vapi');--> statement-breakpoint
CREATE TYPE "public"."creative_format" AS ENUM('square', 'wide', 'story');--> statement-breakpoint
CREATE TYPE "public"."creative_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."post_platform" AS ENUM('facebook', 'instagram', 'google_business', 'linkedin', 'tiktok');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'scheduled', 'published', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."kpi_period" AS ENUM('weekly', 'monthly', 'quarterly');--> statement-breakpoint
CREATE TYPE "public"."kpi_type" AS ENUM('leads_per_month', 'revenue_per_month', 'cost_per_lead', 'close_rate', 'appointments_per_week', 'reviews_per_month', 'custom');--> statement-breakpoint
CREATE TYPE "public"."action_source" AS ENUM('rule_review_after_won', 'rule_followup_after_quoted', 'rule_pause_zero_conv', 'rule_gauge_slipping', 'rule_no_recent_post', 'rosie_suggestion', 'manual');--> statement-breakpoint
CREATE TYPE "public"."action_status" AS ENUM('open', 'in_progress', 'done', 'dismissed', 'snoozed');--> statement-breakpoint
CREATE TYPE "public"."auto_rosie_run_status" AS ENUM('pending', 'success', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."composite_grade" AS ENUM('A', 'B', 'C', 'D', 'F');--> statement-breakpoint
CREATE TYPE "public"."gauge_status" AS ENUM('healthy', 'watch', 'critical', 'none');--> statement-breakpoint
CREATE TYPE "public"."competitor_signal_kind" AS ENUM('new_ad', 'ad_paused', 'photo_added', 'hours_changed', 'review_burst', 'post_published', 'domain_changed', 'note');--> statement-breakpoint
CREATE TYPE "public"."landing_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."landing_template" AS ENUM('service_hero', 'promo', 'review_request', 'lead_form');--> statement-breakpoint
CREATE TYPE "public"."conversion_platform" AS ENUM('meta', 'google_ads', 'tiktok');--> statement-breakpoint
CREATE TYPE "public"."conversion_status" AS ENUM('queued', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."call_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."call_disposition" AS ENUM('qualified', 'not_qualified', 'callback_requested', 'wrong_number', 'no_disposition');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('queued', 'ringing', 'in_progress', 'completed', 'no_answer', 'failed', 'voicemail');--> statement-breakpoint
CREATE TYPE "public"."usage_kind" AS ENUM('llm_tokens', 'llm_request', 'sms_sent', 'sms_received', 'image_generated', 'voice_minutes');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused');--> statement-breakpoint
CREATE TYPE "public"."ad_campaign_status" AS ENUM('active', 'paused', 'archived', 'deleted', 'draft', 'in_review', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."ad_platform" AS ENUM('meta', 'google_ads', 'tiktok');--> statement-breakpoint
CREATE TYPE "public"."cadence_run_status" AS ENUM('scheduled', 'running', 'completed', 'stopped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."cadence_trigger" AS ENUM('lead_created', 'stage_change', 'manual');--> statement-breakpoint
CREATE TYPE "public"."bulk_message_status" AS ENUM('draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."bulk_recipient_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."applicant_status" AS ENUM('new', 'contacted', 'interview', 'offer', 'hired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('draft', 'open', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('integration.connect', 'integration.disconnect', 'integration.update', 'api_key.create', 'api_key.revoke', 'member.invite', 'member.accept', 'member.revoke', 'member.role_change', 'billing.checkout', 'billing.portal', 'billing.subscription_change', 'branding.update', 'spend_budget.update', 'tenant.update', 'impersonation.start', 'impersonation.end', 'lead.export', 'data.delete_request');--> statement-breakpoint
CREATE TYPE "public"."consent_method" AS ENUM('web_form', 'lead_webhook', 'sms_double_optin', 'voice', 'manual', 'import');--> statement-breakpoint
CREATE TYPE "public"."consent_scope" AS ENUM('sms_marketing', 'email_marketing', 'all');--> statement-breakpoint
CREATE TYPE "public"."dsar_request_kind" AS ENUM('export', 'delete');--> statement-breakpoint
CREATE TYPE "public"."dsar_request_status" AS ENUM('received', 'verified', 'completed', 'denied');--> statement-breakpoint
CREATE TYPE "public"."opt_out_source" AS ENUM('sms_keyword', 'operator_manual', 'dsar_request', 'bounce', 'complaint');--> statement-breakpoint
CREATE TYPE "public"."dlq_status" AS ENUM('pending', 'retrying', 'resolved', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."outbound_event" AS ENUM('lead.created', 'lead.stage_changed', 'lead.won', 'conversation.message_received', 'conversation.message_sent', 'call.completed', 'review.received');--> statement-breakpoint
CREATE TYPE "public"."experiment_status" AS ENUM('draft', 'running', 'paused', 'concluded');--> statement-breakpoint
CREATE TYPE "public"."experiment_surface" AS ENUM('cadence', 'landing_headline', 'reply_template');--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"custom_domain" text,
	"custom_domain_root_slug" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"locale" text DEFAULT 'en-US' NOT NULL,
	"region" "tenant_region" DEFAULT 'us' NOT NULL,
	"residency_only" text,
	"brand_theme" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'operator' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_user_id_tenant_id_pk" PRIMARY KEY("user_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "business_profile" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"legal_name" text,
	"phone" text,
	"email" text,
	"website" text,
	"address" jsonb,
	"category" text,
	"services" jsonb,
	"service_area" jsonb,
	"hours" jsonb,
	"features" jsonb,
	"brand_voice" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rosie_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" "rosie_message_role" NOT NULL,
	"content" text NOT NULL,
	"raw" jsonb,
	"usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rosie_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text,
	"phone" text,
	"email" text,
	"source" "lead_source" DEFAULT 'manual' NOT NULL,
	"stage" "lead_stage" DEFAULT 'new' NOT NULL,
	"is_commercial" integer DEFAULT 0 NOT NULL,
	"score" integer,
	"owner_id" uuid,
	"metadata" jsonb,
	"attribution" jsonb,
	"first_contact_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"won_at" timestamp with time zone,
	"lost_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid,
	"channel" "conversation_channel" DEFAULT 'sms' NOT NULL,
	"provider" "messaging_provider" NOT NULL,
	"external_id" text,
	"participant_phone" text,
	"participant_email" text,
	"participant_name" text,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"last_message_preview" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"sender_type" "message_sender_type" NOT NULL,
	"sender_user_id" uuid,
	"body" text NOT NULL,
	"external_id" text,
	"provider_metadata" jsonb,
	"language" text,
	"translated_body" text,
	"translated_to" text,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"config" jsonb,
	"secrets" jsonb,
	"webhook_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"kind" "creative_kind" DEFAULT 'image' NOT NULL,
	"format" "creative_format" DEFAULT 'square' NOT NULL,
	"name" text,
	"provider" text,
	"model" text,
	"prompt" text,
	"inputs" jsonb,
	"storage_path" text,
	"url" text,
	"usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"destination_url" text NOT NULL,
	"style" jsonb,
	"storage_path" text,
	"scan_count" integer DEFAULT 0 NOT NULL,
	"last_scan_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"qr_code_id" uuid,
	"fingerprint" text,
	"referer" text,
	"user_agent" text,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"platform" "post_platform" DEFAULT 'facebook' NOT NULL,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"body" text NOT NULL,
	"title" text,
	"media_paths" jsonb,
	"brand_voice_snapshot" jsonb,
	"ai_meta" jsonb,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"failure_reason" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kpi_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"actual_value" numeric(12, 2) NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "kpi_type" NOT NULL,
	"period" "kpi_period" DEFAULT 'monthly' NOT NULL,
	"target_value" numeric(12, 2) NOT NULL,
	"direction" text DEFAULT 'higher_better' NOT NULL,
	"unit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" "action_source" NOT NULL,
	"status" "action_status" DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"priority" integer DEFAULT 5 NOT NULL,
	"assignee_user_id" uuid,
	"due_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"related_entity_type" text,
	"related_entity_id" uuid,
	"metadata" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_rosie_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rule_name" text NOT NULL,
	"status" "auto_rosie_run_status" DEFAULT 'success' NOT NULL,
	"inputs" jsonb,
	"outputs" jsonb,
	"diff" jsonb,
	"undo_token" text,
	"error" text,
	"related_entity_type" text,
	"related_entity_id" uuid,
	"action_id" uuid,
	"usage" jsonb,
	"duration_ms" numeric(10, 0),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"paid_score" integer,
	"paid_status" "gauge_status" DEFAULT 'none' NOT NULL,
	"organic_score" integer,
	"organic_status" "gauge_status" DEFAULT 'none' NOT NULL,
	"website_score" integer,
	"website_status" "gauge_status" DEFAULT 'none' NOT NULL,
	"kpis_score" integer,
	"kpis_status" "gauge_status" DEFAULT 'none' NOT NULL,
	"composite_score" integer,
	"composite_grade" "composite_grade",
	"pacing_headline" text,
	"breakdown" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"competitor_id" uuid NOT NULL,
	"kind" "competitor_signal_kind" NOT NULL,
	"summary" text NOT NULL,
	"payload" jsonb,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"gbp_url" text,
	"meta_page_id" text,
	"notes" text,
	"last_scan_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"template" "landing_template" DEFAULT 'service_hero' NOT NULL,
	"status" "landing_status" DEFAULT 'draft' NOT NULL,
	"content" jsonb,
	"theme" jsonb,
	"campaign_id" uuid,
	"lead_webhook_url" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"conversion_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"landing_page_id" uuid,
	"fingerprint" text,
	"referer" text,
	"user_agent" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"qr_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid,
	"platform" "conversion_platform" NOT NULL,
	"event_name" text NOT NULL,
	"event_id" text NOT NULL,
	"status" "conversion_status" DEFAULT 'queued' NOT NULL,
	"value" numeric(12, 2),
	"currency" text DEFAULT 'USD',
	"request_payload" jsonb,
	"response_payload" jsonb,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid,
	"conversation_id" uuid,
	"external_id" text,
	"provider" text DEFAULT 'vapi' NOT NULL,
	"direction" "call_direction" NOT NULL,
	"from_number" text,
	"to_number" text,
	"status" "call_status" DEFAULT 'queued' NOT NULL,
	"disposition" "call_disposition" DEFAULT 'no_disposition' NOT NULL,
	"transcript" text,
	"summary" text,
	"duration_sec" numeric(8, 2),
	"recording_url" text,
	"raw" jsonb,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spend_budgets" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"llm_usd_cap" numeric(10, 2),
	"sms_cap" numeric(10, 0),
	"image_cap" numeric(10, 0),
	"voice_minutes_cap" numeric(10, 0),
	"hard_block" text DEFAULT 'true' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "usage_kind" NOT NULL,
	"units" numeric(14, 3) NOT NULL,
	"cost_usd" numeric(10, 4) DEFAULT '0' NOT NULL,
	"model" text,
	"source" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reported_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" text,
	"status" "subscription_status" DEFAULT 'incomplete' NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" jsonb,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"platform" "ad_platform" NOT NULL,
	"external_id" text NOT NULL,
	"name" text,
	"currency" text,
	"timezone" text,
	"status" text,
	"raw" jsonb,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"platform" "ad_platform" NOT NULL,
	"external_id" text NOT NULL,
	"name" text,
	"objective" text,
	"status" "ad_campaign_status" DEFAULT 'unknown' NOT NULL,
	"daily_budget" numeric(14, 4),
	"lifetime_budget" numeric(14, 4),
	"raw" jsonb,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_metrics_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"campaign_id" uuid,
	"platform" "ad_platform" NOT NULL,
	"date" date NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"spend_usd" numeric(12, 4) DEFAULT '0' NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"revenue_usd" numeric(14, 4) DEFAULT '0' NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cadence_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cadence_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"step_index" integer DEFAULT 0 NOT NULL,
	"status" "cadence_run_status" DEFAULT 'scheduled' NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_step_ran_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cadences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"trigger" "cadence_trigger" DEFAULT 'manual' NOT NULL,
	"trigger_stage" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"steps" jsonb NOT NULL,
	"stop_on_reply" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_message_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bulk_message_id" uuid NOT NULL,
	"lead_id" uuid,
	"phone" text NOT NULL,
	"status" "bulk_recipient_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	"external_id" text
);
--> statement-breakpoint
CREATE TABLE "bulk_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"filter" jsonb,
	"status" "bulk_message_status" DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"error" text,
	"recipient_count" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "membership_role" DEFAULT 'operator' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_applicants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"notes" text,
	"status" "applicant_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"requirements" text,
	"compensation" text,
	"status" "job_status" DEFAULT 'draft' NOT NULL,
	"surfaces" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "specialists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"phone" text,
	"email" text,
	"notes" text,
	"tags" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_label" text,
	"action" "audit_action" NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"summary" text,
	"payload" jsonb,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid,
	"phone" text,
	"email" text,
	"method" "consent_method" NOT NULL,
	"scope" "consent_scope" DEFAULT 'sms_marketing' NOT NULL,
	"disclosure" text NOT NULL,
	"user_response" text,
	"source" text,
	"ip_hash" text,
	"user_agent" text,
	"metadata" jsonb,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dsar_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "dsar_request_kind" NOT NULL,
	"status" "dsar_request_status" DEFAULT 'received' NOT NULL,
	"email" text,
	"phone" text,
	"notes" text,
	"verify_token_hash" text,
	"verified_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" uuid,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_opt_outs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"source" "opt_out_source" NOT NULL,
	"keyword" text,
	"notes" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slow_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"label" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"sql_preview" text,
	"path" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_vitals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"metric" text NOT NULL,
	"value" integer NOT NULL,
	"rating" text,
	"path" text,
	"device_type" text,
	"connection" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dead_letter_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"source" text NOT NULL,
	"status" "dlq_status" DEFAULT 'pending' NOT NULL,
	"summary" text,
	"payload" jsonb NOT NULL,
	"last_error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"replay_count" integer DEFAULT 0 NOT NULL,
	"last_replay_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"event" "outbound_event" NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"request_body" jsonb,
	"response_status" integer,
	"response_body" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"label" text NOT NULL,
	"config" jsonb NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"score" numeric(6, 4) DEFAULT '0.5000' NOT NULL,
	"is_winner" text
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"surface" "experiment_surface" NOT NULL,
	"slug" text NOT NULL,
	"status" "experiment_status" DEFAULT 'draft' NOT NULL,
	"goal" text,
	"impressions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"concluded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_profile" ADD CONSTRAINT "business_profile_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosie_messages" ADD CONSTRAINT "rosie_messages_thread_id_rosie_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."rosie_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosie_threads" ADD CONSTRAINT "rosie_threads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosie_threads" ADD CONSTRAINT "rosie_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_clicks" ADD CONSTRAINT "tracking_clicks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_clicks" ADD CONSTRAINT "tracking_clicks_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_values" ADD CONSTRAINT "kpi_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_values" ADD CONSTRAINT "kpi_values_kpi_id_kpis_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_rosie_runs" ADD CONSTRAINT "auto_rosie_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_snapshots" ADD CONSTRAINT "metrics_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_signals" ADD CONSTRAINT "competitor_signals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_signals" ADD CONSTRAINT "competitor_signals_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_landing_page_id_landing_pages_id_fk" FOREIGN KEY ("landing_page_id") REFERENCES "public"."landing_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_budgets" ADD CONSTRAINT "spend_budgets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_account_id_ad_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_metrics_daily" ADD CONSTRAINT "ad_metrics_daily_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_metrics_daily" ADD CONSTRAINT "ad_metrics_daily_account_id_ad_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_metrics_daily" ADD CONSTRAINT "ad_metrics_daily_campaign_id_ad_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cadence_runs" ADD CONSTRAINT "cadence_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cadence_runs" ADD CONSTRAINT "cadence_runs_cadence_id_cadences_id_fk" FOREIGN KEY ("cadence_id") REFERENCES "public"."cadences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cadence_runs" ADD CONSTRAINT "cadence_runs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cadences" ADD CONSTRAINT "cadences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_message_recipients" ADD CONSTRAINT "bulk_message_recipients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_message_recipients" ADD CONSTRAINT "bulk_message_recipients_bulk_message_id_bulk_messages_id_fk" FOREIGN KEY ("bulk_message_id") REFERENCES "public"."bulk_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_message_recipients" ADD CONSTRAINT "bulk_message_recipients_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_messages" ADD CONSTRAINT "bulk_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_messages" ADD CONSTRAINT "bulk_messages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applicants" ADD CONSTRAINT "job_applicants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applicants" ADD CONSTRAINT "job_applicants_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialists" ADD CONSTRAINT "specialists_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_opt_outs" ADD CONSTRAINT "sms_opt_outs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slow_queries" ADD CONSTRAINT "slow_queries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_vitals" ADD CONSTRAINT "web_vitals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscription_id_webhook_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."webhook_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_variants" ADD CONSTRAINT "experiment_variants_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_custom_domain_idx" ON "tenants" USING btree ("custom_domain");--> statement-breakpoint
CREATE INDEX "leads_tenant_stage_idx" ON "leads" USING btree ("tenant_id","stage");--> statement-breakpoint
CREATE INDEX "leads_tenant_last_message_idx" ON "leads" USING btree ("tenant_id","last_message_at");--> statement-breakpoint
CREATE INDEX "leads_tenant_phone_idx" ON "leads" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "conv_tenant_last_message_idx" ON "conversations" USING btree ("tenant_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conv_tenant_phone_idx" ON "conversations" USING btree ("tenant_id","participant_phone");--> statement-breakpoint
CREATE UNIQUE INDEX "conv_provider_external_idx" ON "conversations" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "msg_conv_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "msg_tenant_created_idx" ON "messages" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "msg_external_idx" ON "messages" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_tenant_provider_idx" ON "integrations" USING btree ("tenant_id","provider");--> statement-breakpoint
CREATE INDEX "creatives_tenant_created_idx" ON "creatives" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "qr_code_idx" ON "qr_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "qr_tenant_created_idx" ON "qr_codes" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "clicks_qr_created_idx" ON "tracking_clicks" USING btree ("qr_code_id","created_at");--> statement-breakpoint
CREATE INDEX "clicks_tenant_created_idx" ON "tracking_clicks" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_tenant_scheduled_idx" ON "posts" USING btree ("tenant_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "posts_tenant_status_idx" ON "posts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_values_kpi_period_idx" ON "kpi_values" USING btree ("kpi_id","period_start");--> statement-breakpoint
CREATE INDEX "kpi_values_tenant_period_idx" ON "kpi_values" USING btree ("tenant_id","period_start");--> statement-breakpoint
CREATE INDEX "kpis_tenant_idx" ON "kpis" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "actions_tenant_status_idx" ON "actions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "actions_tenant_priority_idx" ON "actions" USING btree ("tenant_id","priority");--> statement-breakpoint
CREATE INDEX "actions_source_idx" ON "actions" USING btree ("tenant_id","source");--> statement-breakpoint
CREATE INDEX "auto_rosie_runs_tenant_created_idx" ON "auto_rosie_runs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "auto_rosie_runs_tenant_rule_idx" ON "auto_rosie_runs" USING btree ("tenant_id","rule_name");--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_tenant_date_idx" ON "metrics_snapshots" USING btree ("tenant_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "metrics_tenant_created_idx" ON "metrics_snapshots" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "competitor_signals_tenant_observed_idx" ON "competitor_signals" USING btree ("tenant_id","observed_at");--> statement-breakpoint
CREATE INDEX "competitor_signals_competitor_observed_idx" ON "competitor_signals" USING btree ("competitor_id","observed_at");--> statement-breakpoint
CREATE INDEX "competitors_tenant_idx" ON "competitors" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "landing_slug_idx" ON "landing_pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "landing_tenant_status_idx" ON "landing_pages" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "page_views_page_created_idx" ON "page_views" USING btree ("landing_page_id","created_at");--> statement-breakpoint
CREATE INDEX "page_views_tenant_created_idx" ON "page_views" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "conv_events_tenant_created_idx" ON "conversion_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "conv_events_lead_platform_idx" ON "conversion_events" USING btree ("lead_id","platform");--> statement-breakpoint
CREATE INDEX "calls_tenant_created_idx" ON "calls" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "calls_external_idx" ON "calls" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "usage_tenant_created_idx" ON "usage_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_tenant_kind_created_idx" ON "usage_events" USING btree ("tenant_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "usage_unreported_idx" ON "usage_events" USING btree ("reported_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subs_tenant_idx" ON "subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subs_stripe_customer_idx" ON "subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subs_stripe_subscription_idx" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "api_keys_tenant_idx" ON "api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "ad_accounts_tenant_platform_idx" ON "ad_accounts" USING btree ("tenant_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_accounts_platform_external_idx" ON "ad_accounts" USING btree ("platform","external_id");--> statement-breakpoint
CREATE INDEX "ad_campaigns_tenant_platform_idx" ON "ad_campaigns" USING btree ("tenant_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_campaigns_platform_external_idx" ON "ad_campaigns" USING btree ("platform","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_metrics_campaign_date_idx" ON "ad_metrics_daily" USING btree ("campaign_id","date");--> statement-breakpoint
CREATE INDEX "ad_metrics_tenant_date_idx" ON "ad_metrics_daily" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX "ad_metrics_platform_date_idx" ON "ad_metrics_daily" USING btree ("platform","date");--> statement-breakpoint
CREATE INDEX "cadence_runs_tenant_next_idx" ON "cadence_runs" USING btree ("tenant_id","next_run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cadence_runs_cadence_lead_idx" ON "cadence_runs" USING btree ("cadence_id","lead_id");--> statement-breakpoint
CREATE INDEX "cadences_tenant_idx" ON "cadences" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bulk_recip_bulk_status_idx" ON "bulk_message_recipients" USING btree ("bulk_message_id","status");--> statement-breakpoint
CREATE INDEX "bulk_msg_tenant_status_idx" ON "bulk_messages" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "invitations_tenant_email_idx" ON "invitations" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "invitations_token_idx" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "applicants_job_status_idx" ON "job_applicants" USING btree ("job_id","status");--> statement-breakpoint
CREATE INDEX "jobs_tenant_status_idx" ON "jobs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "specialists_tenant_category_idx" ON "specialists" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "audit_log_tenant_created_idx" ON "audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_tenant_action_idx" ON "audit_log" USING btree ("tenant_id","action");--> statement-breakpoint
CREATE INDEX "consent_records_tenant_phone_idx" ON "consent_records" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "consent_records_tenant_lead_idx" ON "consent_records" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "dsar_tenant_status_idx" ON "dsar_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_opt_outs_tenant_phone_idx" ON "sms_opt_outs" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_tenant_idx" ON "push_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "slow_queries_created_idx" ON "slow_queries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "slow_queries_duration_idx" ON "slow_queries" USING btree ("duration_ms");--> statement-breakpoint
CREATE INDEX "web_vitals_created_idx" ON "web_vitals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "web_vitals_metric_idx" ON "web_vitals" USING btree ("metric","created_at");--> statement-breakpoint
CREATE INDEX "dlq_status_idx" ON "dead_letter_queue" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "dlq_source_idx" ON "dead_letter_queue" USING btree ("source","created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_subscription_idx" ON "webhook_deliveries" USING btree ("subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_event_idx" ON "webhook_deliveries" USING btree ("event","created_at");--> statement-breakpoint
CREATE INDEX "webhook_subs_tenant_idx" ON "webhook_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "experiment_variants_experiment_idx" ON "experiment_variants" USING btree ("experiment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "experiments_tenant_slug_idx" ON "experiments" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "experiments_status_idx" ON "experiments" USING btree ("tenant_id","status");