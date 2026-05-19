-- Phase 5: conversion_events, calls.
-- Also extends leads with attribution + score (added via drizzle push).

alter table public.conversion_events enable row level security;
alter table public.calls enable row level security;

create policy conversion_events_member on public.conversion_events
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy calls_member on public.calls
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- Realtime: surface inbound calls in the inbox as they happen.
alter publication supabase_realtime add table public.calls;
