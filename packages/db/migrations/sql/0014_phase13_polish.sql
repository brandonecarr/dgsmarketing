-- Phase 13: UX polish — custom domains, push subscriptions, Vapi assistant config.

-- 1. Custom domain on tenants.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS custom_domain_root_slug text;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_custom_domain_idx ON tenants (custom_domain);

-- 2. Per-user web-push subscriptions.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx ON push_subscriptions (endpoint);
CREATE INDEX IF NOT EXISTS push_subscriptions_tenant_idx ON push_subscriptions (tenant_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_member_select ON push_subscriptions;
CREATE POLICY push_subscriptions_member_select ON push_subscriptions
  FOR SELECT USING (is_tenant_member(tenant_id));
DROP POLICY IF EXISTS push_subscriptions_member_modify ON push_subscriptions;
CREATE POLICY push_subscriptions_member_modify ON push_subscriptions
  FOR ALL USING (is_tenant_member(tenant_id));

-- 3. Storage bucket for tenant logos (idempotent).
INSERT INTO storage.buckets (id, name, public)
  VALUES ('branding', 'branding', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
  VALUES ('voicemails', 'voicemails', true)
  ON CONFLICT (id) DO NOTHING;
