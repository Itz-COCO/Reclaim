-- Reclaim platform operators, curated public cases, location and media.
-- Additive migration after the initial schema and permissions migration.
-- No operator accounts are inserted here. The first platform owner is granted
-- separately by the trusted project operator.

begin;

create table if not exists public.platform_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'operator' check (role in ('owner','operator')),
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists platform_members_role_idx on public.platform_members(role);
alter table public.platform_members enable row level security;

create or replace function public.is_reclaim_platform_operator()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.platform_members where user_id=auth.uid()); $$;

create or replace function public.is_reclaim_platform_owner()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.platform_members where user_id=auth.uid() and role='owner'); $$;

create policy "Platform members can read their own role"
  on public.platform_members for select
  using (user_id=auth.uid() or public.is_reclaim_platform_owner());
create policy "Platform owner manages platform operators"
  on public.platform_members for all
  using (public.is_reclaim_platform_owner())
  with check (public.is_reclaim_platform_owner());

create or replace function public.can_access_reclaim_project(target_project uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_reclaim_platform_operator()
  or exists (select 1 from public.projects p where p.id=target_project and p.owner_id=auth.uid())
  or exists (select 1 from public.project_members m where m.project_id=target_project and m.user_id=auth.uid());
$$;

create or replace function public.can_edit_reclaim_project(target_project uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_reclaim_platform_operator()
  or exists (select 1 from public.projects p where p.id=target_project and p.owner_id=auth.uid())
  or exists (select 1 from public.project_members m where m.project_id=target_project and m.user_id=auth.uid() and m.role='member');
$$;

create or replace function public.add_reclaim_project_member(target_project uuid, target_email text, target_role text)
returns void language plpgsql security definer set search_path = public
as $$
declare target_user uuid;
begin
  if not (public.is_reclaim_platform_operator() or exists (select 1 from public.projects where id=target_project and owner_id=auth.uid())) then raise exception 'Not authorised to add members'; end if;
  if target_role not in ('member','viewer','contributor') then raise exception 'Role must be member, viewer or contributor'; end if;
  select id into target_user from auth.users where lower(email)=lower(trim(target_email));
  if target_user is null then raise exception 'No existing account matches this email'; end if;
  insert into public.project_members(project_id,user_id,role) values(target_project,target_user,target_role)
    on conflict(project_id,user_id) do update set role=excluded.role;
end;
$$;
create or replace function public.list_reclaim_project_members(target_project uuid)
returns table(project_id uuid,user_id uuid,display_name text,email text,role text)
language sql security definer set search_path = public
as $$
  select m.project_id,m.user_id,coalesce(p.full_name,''),coalesce(u.email,''),m.role
  from public.project_members m left join public.profiles p on p.id=m.user_id left join auth.users u on u.id=m.user_id
  where m.project_id=target_project and (public.is_reclaim_platform_operator() or exists (select 1 from public.projects pr where pr.id=target_project and pr.owner_id=auth.uid()));
$$;
revoke all on function public.add_reclaim_project_member(uuid,text,text) from public, anon, authenticated;
grant execute on function public.add_reclaim_project_member(uuid,text,text) to authenticated;
revoke all on function public.list_reclaim_project_members(uuid) from public, anon, authenticated;
grant execute on function public.list_reclaim_project_members(uuid) to authenticated;

-- Project and building locations. Exact coordinates are never required for a
-- public record; public coordinates are a separately confirmed representation.
alter table public.projects add column if not exists location_label text not null default '';
alter table public.projects add column if not exists latitude double precision;
alter table public.projects add column if not exists longitude double precision;
alter table public.projects add column if not exists public_latitude double precision;
alter table public.projects add column if not exists public_longitude double precision;
alter table public.projects add column if not exists location_precision text not null default 'hidden';
alter table public.projects drop constraint if exists projects_location_precision_check;
alter table public.projects add constraint projects_location_precision_check check (location_precision in ('exact','approximate','area','hidden'));
alter table public.buildings add column if not exists public_visibility text not null default 'private';
alter table public.evidence_items add column if not exists public_visibility text not null default 'private';
alter table public.survey_datasets add column if not exists public_visibility text not null default 'private';
alter table public.pathways add column if not exists public_visibility text not null default 'private';
alter table public.roadmap_items add column if not exists public_visibility text not null default 'private';

-- Public publishing is explicit at record level. Existing Dakota rows become
-- visible only because it is the deliberate supplied case study.
update public.projects set visibility='public',location_label='Dakota Crescent, Singapore',location_precision='area',updated_at=now() where slug='dakota-crescent';
update public.buildings set public_visibility='public' where project_id in (select id from public.projects where slug='dakota-crescent');
update public.evidence_items set public_visibility='public' where project_id in (select id from public.projects where slug='dakota-crescent');
update public.survey_datasets set public_visibility='public' where project_id in (select id from public.projects where slug='dakota-crescent');
update public.pathways set public_visibility='public' where project_id in (select id from public.projects where slug='dakota-crescent');
update public.roadmap_items set public_visibility='public' where project_id in (select id from public.projects where slug='dakota-crescent');

create policy "Anyone can read public projects" on public.projects for select using (visibility='public');
create policy "Anyone can read published buildings" on public.buildings for select using (public_visibility='public' and exists (select 1 from public.projects p where p.id=project_id and p.visibility='public'));
create policy "Anyone can read published evidence" on public.evidence_items for select using (public_visibility='public' and exists (select 1 from public.projects p where p.id=project_id and p.visibility='public'));
create policy "Anyone can read published surveys" on public.survey_datasets for select using (public_visibility='public' and exists (select 1 from public.projects p where p.id=project_id and p.visibility='public'));
create policy "Anyone can read published pathways" on public.pathways for select using (public_visibility='public' and exists (select 1 from public.projects p where p.id=project_id and p.visibility='public'));
create policy "Anyone can read published roadmap" on public.roadmap_items for select using (public_visibility='public' and exists (select 1 from public.projects p where p.id=project_id and p.visibility='public'));

do $$ begin
  if to_regclass('public.blockages') is not null then
    execute 'alter table public.blockages add column if not exists public_visibility text not null default ''private''';
    execute 'update public.blockages set public_visibility=''public'' where project_id in (select id from public.projects where slug=''dakota-crescent'')';
    execute 'create policy "Anyone can read published blockages" on public.blockages for select using (public_visibility=''public'' and exists (select 1 from public.projects p where p.id=project_id and p.visibility=''public''))';
  end if;
  if to_regclass('public.retrofit_measures') is not null then
    execute 'alter table public.retrofit_measures add column if not exists public_visibility text not null default ''private''';
    execute 'update public.retrofit_measures set public_visibility=''public'' where project_id in (select id from public.projects where slug=''dakota-crescent'')';
    execute 'create policy "Anyone can read published measures" on public.retrofit_measures for select using (public_visibility=''public'' and exists (select 1 from public.projects p where p.id=project_id and p.visibility=''public''))';
  end if;
  if to_regclass('public.decision_gates') is not null then
    execute 'alter table public.decision_gates add column if not exists public_visibility text not null default ''private''';
    execute 'update public.decision_gates set public_visibility=''public'' where project_id in (select id from public.projects where slug=''dakota-crescent'')';
    execute 'create policy "Anyone can read published gates" on public.decision_gates for select using (public_visibility=''public'' and exists (select 1 from public.projects p where p.id=project_id and p.visibility=''public''))';
  end if;
end $$;

create table if not exists public.project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete set null,
  uploaded_by uuid references auth.users(id) on delete set null,
  storage_path text not null,
  thumbnail_path text not null default '',
  caption text not null default '',
  alt_text text not null default '',
  source text not null default '',
  consent_note text not null default '',
  taken_at date,
  visibility text not null default 'private' check (visibility in ('private','members','public')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected','needs clarification')),
  created_at timestamptz not null default now()
);
create index if not exists project_media_project_idx on public.project_media(project_id,created_at desc);
alter table public.project_media enable row level security;
create policy "Members can read authorised media" on public.project_media for select using (public.can_access_reclaim_project(project_id) or (visibility='public' and moderation_status='approved'));
create policy "Editors can add media" on public.project_media for insert with check (public.can_edit_reclaim_project(project_id) and uploaded_by=auth.uid());
create policy "Editors can update media" on public.project_media for update using (public.can_edit_reclaim_project(project_id)) with check (public.can_edit_reclaim_project(project_id));

-- Profiles are identity and contact surfaces only. They never grant access.
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists website_url text not null default '';
alter table public.profiles add column if not exists instagram_url text not null default '';
alter table public.profiles add column if not exists linkedin_url text not null default '';
alter table public.profiles add column if not exists x_url text not null default '';
alter table public.profiles add column if not exists avatar_url text not null default '';

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('profile-avatars','profile-avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Users can replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
  with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Public can read approved profile avatars"
  on storage.objects for select to public
  using (bucket_id='profile-avatars');

commit;
