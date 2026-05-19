-- Phase 19: dead-letter queue for failed background operations.

DO $$ BEGIN
  CREATE TYPE dlq_status AS ENUM ('pending', 'retrying', 'resolved', 'abandoned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  source text NOT NULL,
  status dlq_status NOT NULL DEFAULT 'pending',
  summary text,
  payload jsonb NOT NULL,
  last_error text,
  attempts integer NOT NULL DEFAULT 0,
  replay_count integer NOT NULL DEFAULT 0,
  last_replay_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dlq_status_idx ON dead_letter_queue (status, created_at DESC);
CREATE INDEX IF NOT EXISTS dlq_source_idx ON dead_letter_queue (source, created_at DESC);

-- DLQ is operator-internal — no RLS policies; access goes through the
-- /dlq admin page which already requires an authenticated session.
