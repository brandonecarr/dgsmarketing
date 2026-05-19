-- Phase 8: RLS for ad_accounts / ad_campaigns / ad_metrics_daily.

alter table public.ad_accounts enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_metrics_daily enable row level security;

create policy ad_accounts_member on public.ad_accounts
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy ad_campaigns_member on public.ad_campaigns
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy ad_metrics_member_read on public.ad_metrics_daily
  for select using (public.is_tenant_member(tenant_id));
