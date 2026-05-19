-- Phase 22: coaching loops (experiments + variants).

DO $$ BEGIN
  CREATE TYPE experiment_status AS ENUM ('draft', 'running', 'paused', 'concluded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE experiment_surface AS ENUM ('cadence', 'landing_headline', 'reply_template');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  surface experiment_surface NOT NULL,
  slug text NOT NULL,
  status experiment_status NOT NULL DEFAULT 'draft',
  goal text,
  impressions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  concluded_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS experiments_tenant_slug_idx
  ON experiments (tenant_id, slug);
CREATE INDEX IF NOT EXISTS experiments_status_idx
  ON experiments (tenant_id, status);

CREATE TABLE IF NOT EXISTS experiment_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  label text NOT NULL,
  config jsonb NOT NULL,
  impressions integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  score numeric(6, 4) NOT NULL DEFAULT 0.5000,
  is_winner text
);
CREATE INDEX IF NOT EXISTS experiment_variants_experiment_idx
  ON experiment_variants (experiment_id);

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS experiments_member_all ON experiments;
CREATE POLICY experiments_member_all ON experiments
  FOR ALL USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS experiment_variants_member_all ON experiment_variants;
CREATE POLICY experiment_variants_member_all ON experiment_variants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM experiments e
       WHERE e.id = experiment_variants.experiment_id
         AND is_tenant_member(e.tenant_id)
    )
  );
