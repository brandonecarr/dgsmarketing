-- Phase 1: RLS for leads, conversations, messages, integrations.
-- Plus Supabase Realtime publication so the inbox can subscribe live.

alter table public.leads enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.integrations enable row level security;

create policy leads_member on public.leads
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy conversations_member on public.conversations
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy messages_member on public.messages
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy integrations_member on public.integrations
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- Realtime: clients subscribe to changes for their tenant via RLS.
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.leads;
