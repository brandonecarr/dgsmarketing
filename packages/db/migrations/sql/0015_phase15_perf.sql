-- Phase 15: performance + observability tables.

CREATE TABLE IF NOT EXISTS slow_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  label text NOT NULL,
  duration_ms integer NOT NULL,
  sql_preview text,
  path text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS slow_queries_created_idx ON slow_queries (created_at DESC);
CREATE INDEX IF NOT EXISTS slow_queries_duration_idx ON slow_queries (duration_ms DESC);

CREATE TABLE IF NOT EXISTS web_vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  metric text NOT NULL,
  value integer NOT NULL,
  rating text,
  path text,
  device_type text,
  connection text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_vitals_created_idx ON web_vitals (created_at DESC);
CREATE INDEX IF NOT EXISTS web_vitals_metric_idx ON web_vitals (metric, created_at DESC);

-- Both tables are operator-internal — no RLS policies (only the service-role
-- writer and the /perf page reader access them, both server-side).
