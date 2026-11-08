-- Reclaim starter schema. Run in the user's own Supabase SQL Editor.
-- This browser app uses only the public anon/publishable key. Never expose service_role keys.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  organization text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  country text not null default '',
  region text not null default '',
  status text not null default 'In research' check (status in ('In research','Planning','Active','Archived')),
  is_case_study boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,slug)
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member','viewer')),
  joined_at timestamptz not null default now(),
  primary key(project_id,user_id)
);

create or replace function public.can_access_reclaim_project(target_project uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.projects p where p.id = target_project and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.project_members m where m.project_id = target_project and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_reclaim_project(target_project uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.projects p where p.id = target_project and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.project_members m where m.project_id = target_project and m.user_id = auth.uid() and m.role in ('owner','member')
  );
$$;

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  address text not null default '',
  building_type text not null default '',
  current_use text not null default '',
  year_built text not null default '',
  approximate_area text not null default '',
  condition text not null default 'Needs verification',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete set null,
  title text not null,
  kind text not null default 'Other',
  status text not null default 'Needs verification',
  source text not null default '',
  source_url text not null default '',
  summary text not null default '',
  added_by text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  evidence_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.survey_datasets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  row_count integer not null default 0 check (row_count >= 0),
  aggregate_fields jsonb not null default '[]'::jsonb,
  note text not null default '',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.pathways (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  summary text not null default '',
  status text not null default 'Research candidate',
  evidence_needed jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.roadmap_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase text not null default '',
  title text not null,
  description text not null default '',
  status text not null default 'Not started',
  owner text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists projects_owner_idx on public.projects(owner_id);
create index if not exists project_members_user_idx on public.project_members(user_id);
create index if not exists buildings_project_idx on public.buildings(project_id);
create index if not exists evidence_project_idx on public.evidence_items(project_id);
create index if not exists surveys_project_idx on public.survey_datasets(project_id);
create index if not exists pathways_project_idx on public.pathways(project_id);
create index if not exists roadmap_project_idx on public.roadmap_items(project_id);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.buildings enable row level security;
alter table public.evidence_items enable row level security;
alter table public.survey_datasets enable row level security;
alter table public.pathways enable row level security;
alter table public.roadmap_items enable row level security;

create policy "Users can read their own profile" on public.profiles for select using (id = auth.uid());
create policy "Users can create their own profile" on public.profiles for insert with check (id = auth.uid());
create policy "Users can update their own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Users can read owned or joined projects" on public.projects for select using (owner_id = auth.uid() or public.can_access_reclaim_project(id));
create policy "Users can create owned projects" on public.projects for insert with check (owner_id = auth.uid());
create policy "Owners can update projects" on public.projects for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Owners can delete projects" on public.projects for delete using (owner_id = auth.uid());

create policy "Members can view project membership" on public.project_members for select using (user_id = auth.uid() or exists (select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid()));
create policy "Project owners can add members" on public.project_members for insert with check (exists (select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid()));
create policy "Project owners can remove members" on public.project_members for delete using (exists (select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid()));

create policy "Members can read buildings" on public.buildings for select using (public.can_access_reclaim_project(project_id));
create policy "Editors can add buildings" on public.buildings for insert with check (public.can_edit_reclaim_project(project_id));
create policy "Editors can update buildings" on public.buildings for update using (public.can_edit_reclaim_project(project_id)) with check (public.can_edit_reclaim_project(project_id));
create policy "Owners can delete buildings" on public.buildings for delete using (exists (select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid()));

create policy "Members can read evidence" on public.evidence_items for select using (public.can_access_reclaim_project(project_id));
create policy "Editors can add evidence" on public.evidence_items for insert with check (public.can_edit_reclaim_project(project_id));
create policy "Editors can update evidence" on public.evidence_items for update using (public.can_edit_reclaim_project(project_id)) with check (public.can_edit_reclaim_project(project_id));
create policy "Owners can delete evidence" on public.evidence_items for delete using (exists (select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid()));

create policy "Members can read survey summaries" on public.survey_datasets for select using (public.can_access_reclaim_project(project_id));
create policy "Editors can add survey summaries" on public.survey_datasets for insert with check (public.can_edit_reclaim_project(project_id));
create policy "Editors can update survey summaries" on public.survey_datasets for update using (public.can_edit_reclaim_project(project_id)) with check (public.can_edit_reclaim_project(project_id));
create policy "Owners can delete survey summaries" on public.survey_datasets for delete using (exists (select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid()));

create policy "Members can read pathways" on public.pathways for select using (public.can_access_reclaim_project(project_id));
create policy "Editors can add pathways" on public.pathways for insert with check (public.can_edit_reclaim_project(project_id));
create policy "Editors can update pathways" on public.pathways for update using (public.can_edit_reclaim_project(project_id)) with check (public.can_edit_reclaim_project(project_id));
create policy "Owners can delete pathways" on public.pathways for delete using (exists (select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid()));

create policy "Members can read roadmap" on public.roadmap_items for select using (public.can_access_reclaim_project(project_id));
create policy "Editors can add roadmap" on public.roadmap_items for insert with check (public.can_edit_reclaim_project(project_id));
create policy "Editors can update roadmap" on public.roadmap_items for update using (public.can_edit_reclaim_project(project_id)) with check (public.can_edit_reclaim_project(project_id));
create policy "Owners can delete roadmap" on public.roadmap_items for delete using (exists (select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid()));

-- Optional starter profile creation after Supabase Auth sign-up.
create or replace function public.handle_new_reclaim_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name','')) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_reclaim on auth.users;
create trigger on_auth_user_created_reclaim after insert on auth.users for each row execute procedure public.handle_new_reclaim_user();
