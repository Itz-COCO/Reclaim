begin;

alter table public.projects
  add column if not exists public_gallery_enabled
  boolean not null default false;

alter table public.profiles
  add column if not exists public_profile
  boolean not null default false;

drop policy if exists "Anyone can read public profiles"
on public.profiles;

create policy "Anyone can read public profiles"
on public.profiles
for select
using (public_profile = true);

drop policy if exists "Members can read authorised media"
on public.project_media;

create policy "Members can read authorised media"
on public.project_media
for select
using (
  public.can_access_reclaim_project(project_id)
  or (
    visibility = 'public'
    and moderation_status = 'approved'
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.visibility = 'public'
        and p.public_gallery_enabled = true
    )
  )
);

drop policy if exists "Public can read project media files"
on storage.objects;

create policy "Public can read approved public project media files"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'project-media'
  and exists (
    select 1
    from public.project_media m
    join public.projects p on p.id = m.project_id
    where m.storage_path = name
      and m.visibility = 'public'
      and m.moderation_status = 'approved'
      and p.visibility = 'public'
      and p.public_gallery_enabled = true
  )
);

drop policy if exists "Project editors can upload media files"
on storage.objects;

create policy "Project editors can upload media files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'project-media'
  and public.can_edit_reclaim_project(
    (storage.foldername(name))[1]::uuid
  )
);

drop policy if exists "Project editors can delete media files"
on storage.objects;

create policy "Project editors can delete media files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'project-media'
  and public.can_edit_reclaim_project(
    (storage.foldername(name))[1]::uuid
  )
);

commit;
