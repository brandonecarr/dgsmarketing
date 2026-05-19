CREATE TYPE "public"."customer_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" jsonb,
	"service_days" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"service_window" text,
	"zone" text,
	"status" "customer_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"price_per_visit_cents" integer,
	"service_since" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_tenant_status_idx" ON "customers" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "customers_tenant_zone_idx" ON "customers" USING btree ("tenant_id","zone");--> statement-breakpoint
CREATE INDEX "customers_lead_idx" ON "customers" USING btree ("lead_id");