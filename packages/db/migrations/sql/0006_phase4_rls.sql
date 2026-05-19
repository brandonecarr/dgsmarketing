-- Phase 4: competitors, competitor_signals, landing_pages, page_views.

alter table public.competitors enable row level security;
alter table public.competitor_signals enable row level security;
alter table public.landing_pages enable row level security;
alter table public.page_views enable row level security;

create policy competitors_member on public.competitors
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy competitor_signals_member on public.competitor_signals
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy landing_member on public.landing_pages
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- Members can read view rows; the public renderer writes via the service-role client.
create policy page_views_member_read on public.page_views
  for select using (public.is_tenant_member(tenant_id));

-- Published landing pages must be readable by anonymous users.
-- Anon can SELECT only when status = 'published' — the route uses the anon client.
create policy landing_pages_anon_read_published on public.landing_pages
  for select to anon
  using (status = 'published');

-- Realtime: live updates to the Action Plan style competitor feed.
alter publication supabase_realtime add table public.competitor_signals;
