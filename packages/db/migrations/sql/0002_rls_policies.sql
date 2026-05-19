-- Row-level security: a user can only see rows for tenants they belong to.

alter table public.users enable row level security;
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.business_profile enable row level security;
alter table public.rosie_threads enable row level security;
alter table public.rosie_messages enable row level security;

-- Helper: is the current auth user a member of the given tenant?
create or replace function public.is_tenant_member(tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = tenant and m.user_id = auth.uid()
  );
$$;

-- users: self-read/update only.
create policy users_self_read on public.users
  for select using (id = auth.uid());
create policy users_self_update on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- tenants: visible to members only.
create policy tenants_member_read on public.tenants
  for select using (public.is_tenant_member(id));

-- memberships: visible if you're a member of that tenant.
create policy memberships_member_read on public.memberships
  for select using (public.is_tenant_member(tenant_id) or user_id = auth.uid());

-- business_profile: members can read; owners/operators can write (enforced in app layer for now).
create policy bp_member_read on public.business_profile
  for select using (public.is_tenant_member(tenant_id));
create policy bp_member_write on public.business_profile
  for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

-- rosie_threads: members of the tenant.
create policy rt_member on public.rosie_threads
  for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

-- rosie_messages: via thread membership.
create policy rm_member on public.rosie_messages
  for all using (
    exists (select 1 from public.rosie_threads t where t.id = thread_id and public.is_tenant_member(t.tenant_id))
  ) with check (
    exists (select 1 from public.rosie_threads t where t.id = thread_id and public.is_tenant_member(t.tenant_id))
  );
