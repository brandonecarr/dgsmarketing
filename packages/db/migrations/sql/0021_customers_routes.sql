-- Customer records + route management.

DO $$ BEGIN
  CREATE TYPE customer_status AS ENUM ('active', 'paused', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,

  name text NOT NULL,
  phone text,
  email text,

  address jsonb,
  service_days jsonb NOT NULL DEFAULT '[]'::jsonb,
  service_window text,
  zone text,

  status customer_status NOT NULL DEFAULT 'active',
  notes text,
  price_per_visit_cents integer,
  service_since timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_tenant_status_idx ON customers (tenant_id, status);
CREATE INDEX IF NOT EXISTS customers_tenant_zone_idx ON customers (tenant_id, zone);
CREATE INDEX IF NOT EXISTS customers_lead_idx ON customers (lead_id);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_member_all ON customers;
CREATE POLICY customers_member_all ON customers
  FOR ALL USING (is_tenant_member(tenant_id))
  WITH CHECK (is_tenant_member(tenant_id));
