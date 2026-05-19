-- Phase 3: RLS for KPIs, actions, metrics_snapshots, auto_rosie_runs.

alter table public.kpis enable row level security;
alter table public.kpi_values enable row level security;
alter table public.actions enable row level security;
alter table public.metrics_snapshots enable row level security;
alter table public.auto_rosie_runs enable row level security;

create policy kpis_member on public.kpis
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy kpi_values_member on public.kpi_values
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy actions_member on public.actions
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy metrics_member on public.metrics_snapshots
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy auto_rosie_runs_member_read on public.auto_rosie_runs
  for select using (public.is_tenant_member(tenant_id));

-- Realtime: live updates when an Auto-Rosie run emits a new action.
alter publication supabase_realtime add table public.actions;
alter publication supabase_realtime add table public.auto_rosie_runs;
