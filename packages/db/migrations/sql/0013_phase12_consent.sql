-- Phase 12: RLS for consent_records / sms_opt_outs / dsar_requests.

alter table public.consent_records enable row level security;
alter table public.sms_opt_outs enable row level security;
alter table public.dsar_requests enable row level security;

create policy consent_records_member on public.consent_records
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy sms_opt_outs_member on public.sms_opt_outs
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy dsar_requests_member on public.dsar_requests
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));
