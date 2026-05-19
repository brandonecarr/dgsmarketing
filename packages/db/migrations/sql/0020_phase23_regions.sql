-- Phase 23: per-tenant data residency.

DO $$ BEGIN
  CREATE TYPE tenant_region AS ENUM ('us', 'eu', 'au');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS region tenant_region NOT NULL DEFAULT 'us',
  ADD COLUMN IF NOT EXISTS residency_only text;

-- Cheap filter for "all tenants pinned to region X" — used by cross-region
-- maintenance jobs that need to skip foreign tenants.
CREATE INDEX IF NOT EXISTS tenants_region_idx ON tenants (region);
