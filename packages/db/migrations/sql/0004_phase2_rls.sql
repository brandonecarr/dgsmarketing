-- Phase 2: RLS for creatives, qr_codes, tracking_clicks, posts.
-- Plus Supabase Storage bucket for generated images (created via dashboard or this script).

alter table public.creatives enable row level security;
alter table public.qr_codes enable row level security;
alter table public.tracking_clicks enable row level security;
alter table public.posts enable row level security;

create policy creatives_member on public.creatives
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy qr_codes_member on public.qr_codes
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy posts_member on public.posts
  for all using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- tracking_clicks: members can read, service-role writes from /q/[code] redirect.
create policy clicks_member_read on public.tracking_clicks
  for select using (public.is_tenant_member(tenant_id));

-- Storage bucket for generated creatives (idempotent).
insert into storage.buckets (id, name, public)
values ('creatives', 'creatives', true)
on conflict (id) do nothing;

-- Public-read on creatives bucket; tenant members can upload via signed URLs from the app.
create policy if not exists "creatives_public_read"
  on storage.objects for select
  using (bucket_id = 'creatives');

-- QR PNGs bucket (smaller; rendered on demand).
insert into storage.buckets (id, name, public)
values ('qr', 'qr', true)
on conflict (id) do nothing;

create policy if not exists "qr_public_read"
  on storage.objects for select
  using (bucket_id = 'qr');
