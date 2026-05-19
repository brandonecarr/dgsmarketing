-- Phase 20: outbound webhook subscriptions + delivery log, API key scopes.

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes jsonb;

DO $$ BEGIN
  CREATE TYPE outbound_event AS ENUM (
    'lead.created',
    'lead.stage_changed',
    'lead.won',
    'conversation.message_received',
    'conversation.message_sent',
    'call.completed',
    'review.received'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE webhook_delivery_status AS ENUM ('pending', 'delivered', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  secret text NOT NULL,
  events jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  suspended_at timestamptz,
  suspended_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_subs_tenant_idx ON webhook_subscriptions (tenant_id);

ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webhook_subs_member_select ON webhook_subscriptions;
CREATE POLICY webhook_subs_member_select ON webhook_subscriptions
  FOR SELECT USING (is_tenant_member(tenant_id));
DROP POLICY IF EXISTS webhook_subs_member_modify ON webhook_subscriptions;
CREATE POLICY webhook_subs_member_modify ON webhook_subscriptions
  FOR ALL USING (is_tenant_member(tenant_id));

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event outbound_event NOT NULL,
  status webhook_delivery_status NOT NULL DEFAULT 'pending',
  request_body jsonb,
  response_status integer,
  response_body text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_subscription_idx
  ON webhook_deliveries (subscription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_deliveries_event_idx
  ON webhook_deliveries (event, created_at DESC);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webhook_deliveries_member_select ON webhook_deliveries;
CREATE POLICY webhook_deliveries_member_select ON webhook_deliveries
  FOR SELECT USING (is_tenant_member(tenant_id));
