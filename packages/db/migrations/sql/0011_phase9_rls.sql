-- Phase 9: RLS for cadences, cadence_runs, bulk_messages, bulk_message_recipients,
-- invitations, specialists, jobs, job_applicants.

alter table public.cadences enable row level security;
alter table public.cadence_runs enable row level security;
alter table public.bulk_messages enable row level security;
alter table public.bulk_message_recipients enable row level security;
alter table public.invitations enable row level security;
alter table public.specialists enable row level security;
alter table public.jobs enable row level security;
alter table public.job_applicants enable row level security;

create policy cadences_member on public.cadences
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy cadence_runs_member on public.cadence_runs
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy bulk_messages_member on public.bulk_messages
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy bulk_recipients_member on public.bulk_message_recipients
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy invitations_member on public.invitations
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy specialists_member on public.specialists
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy jobs_member on public.jobs
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy applicants_member on public.job_applicants
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));
