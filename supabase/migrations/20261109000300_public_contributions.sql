begin;

create table if not exists public.public_contributions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete set null,
  contributor_name text not null default 'Anonymous contributor',
  contributor_email text not null default '',
  body text not null,
  permission_to_publish boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','archived')),
  reviewer_note text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists public_contributions_project_idx
  on public.public_contributions(project_id,created_at desc);

alter table public.public_contributions enable row level security;

drop policy if exists
  "Anyone can submit public contributions"
  on public.public_contributions;

drop policy if exists
  "Operators can review public contributions"
  on public.public_contributions;

create policy
  "Anyone can submit public contributions"
  on public.public_contributions
  for insert
  to anon,authenticated
  with check (
    status='pending'
    and permission_to_publish in (true,false)
  );

create policy
  "Operators can review public contributions"
  on public.public_contributions
  for all
  to authenticated
  using (public.is_reclaim_platform_operator())
  with check (public.is_reclaim_platform_operator());

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'project-media',
  'project-media',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id)
do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

update storage.buckets
set public=false
where id='project-media';

drop policy if exists
  "Project editors can upload media files"
  on storage.objects;

drop policy if exists
  "Public can read project media files"
  on storage.objects;

drop policy if exists
  "Operators can read project media files"
  on storage.objects;

drop policy if exists
  "Project editors can delete media files"
  on storage.objects;

create policy
  "Project editors can upload media files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id='project-media'
    and public.is_reclaim_platform_operator()
  );

create policy
  "Operators can read project media files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id='project-media'
    and public.is_reclaim_platform_operator()
  );

create policy
  "Project editors can delete media files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id='project-media'
    and public.is_reclaim_platform_operator()
  );

commit;
