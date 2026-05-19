-- Phase 6: RLS for usage_events, spend_budgets, subscriptions, api_keys.

alter table public.usage_events enable row level security;
alter table public.spend_budgets enable row level security;
alter table public.subscriptions enable row level security;
alter table public.api_keys enable row level security;

create policy usage_events_member_read on public.usage_events
  for select using (public.is_tenant_member(tenant_id));

create policy spend_budgets_member on public.spend_budgets
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy subscriptions_member_read on public.subscriptions
  for select using (public.is_tenant_member(tenant_id));

create policy api_keys_member on public.api_keys
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));
