-- Phase 7: production hardening.
-- `timezone` + `locale` columns added to tenants (default UTC / en-US) so
-- existing rows keep working while new tenants are auto-set in onboarding.

alter table public.tenants
  add column if not exists timezone text not null default 'UTC',
  add column if not exists locale text not null default 'en-US';
