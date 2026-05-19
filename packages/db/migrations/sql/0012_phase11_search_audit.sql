-- Phase 11: RLS for audit_log + pg_trgm + tsvector indexes for /api/search.

alter table public.audit_log enable row level security;

create policy audit_log_member_read on public.audit_log
  for select using (public.is_tenant_member(tenant_id));

-- Search infrastructure
create extension if not exists pg_trgm;

-- Trigram indexes for lead name / phone / email lookup.
create index if not exists leads_name_trgm_idx
  on public.leads using gin (name gin_trgm_ops);
create index if not exists leads_phone_trgm_idx
  on public.leads using gin (phone gin_trgm_ops);
create index if not exists leads_email_trgm_idx
  on public.leads using gin (email gin_trgm_ops);

-- Full-text on conversation previews + message bodies + post bodies.
create index if not exists conversations_preview_trgm_idx
  on public.conversations using gin (last_message_preview gin_trgm_ops);
create index if not exists messages_body_fts_idx
  on public.messages using gin (to_tsvector('english', body));
create index if not exists posts_body_fts_idx
  on public.posts using gin (to_tsvector('english', body));
