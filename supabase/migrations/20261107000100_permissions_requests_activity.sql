-- Reclaim permissions, access requests and activity layer.
-- Additive migration. Run only after the initial schema/repair is already present.
-- This migration does not send email by itself. The notification_outbox table is
-- intentionally consumed by a server-side Edge Function or approved provider.

begin;

-- Projects are private unless an owner deliberately publishes them later.
alter table public.projects
  add column if not exists visibility text not null default 'private';

alter table public.projects
  drop constraint if exists projects_visibility_check;
alter table public.projects
  add constraint projects_visibility_check
  check (visibility in ('private','public'));

-- Preserve the existing roles while adding a constrained contributor role for
-- narrowly scoped participation. Contributors are not general editors.
alter table public.project_members
  drop constraint if exists project_members_role_check;
alter table public.project_members
  add constraint project_members_role_check
  check (role in ('owner','member','viewer','contributor'));

-- A person may request access before they have a Reclaim account.
create table if not exists public.project_access_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requester_id uuid references auth.users(id) on delete set null,
  requester_email text not null,
  requester_name text not null default '',
  requested_role text not null default 'viewer'
    check (requested_role in ('viewer','member','contributor')),
  message text not null default '',
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','withdrawn')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists access_requests_one_pending_email
  on public.project_access_requests(project_id, lower(requester_email))
  where status = 'pending';
create index if not exists access_requests_project_idx
  on public.project_access_requests(project_id, status, created_at desc);
create index if not exists access_requests_requester_idx
  on public.project_access_requests(requester_id, created_at desc);

-- An auditable record of meaningful changes. The browser may write events only
-- for projects where the current user can edit; reads remain project-scoped.
create table if not exists public.project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists project_activity_project_idx
  on public.project_activity(project_id, created_at desc);

-- Email work is queued as data. A server-side worker/Edge Function sends it,
-- retries it and records the result without exposing provider secrets in React.
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  access_request_id uuid references public.project_access_requests(id) on delete cascade,
  recipient_email text not null,
  notification_type text not null
    check (notification_type in ('access_request_created','access_request_decided','project_invitation')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  last_error text not null default '',
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notification_outbox_pending_idx
  on public.notification_outbox(status, available_at);

-- Replace the helper so contributor access is read-only to core project records.
create or replace function public.can_edit_reclaim_project(target_project uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = target_project and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.project_members m
    where m.project_id = target_project
      and m.user_id = auth.uid()
      and m.role = 'member'
  );
$$;

-- Project owners can see all requests. Requesters can see their own requests.
alter table public.project_access_requests enable row level security;
alter table public.project_activity enable row level security;
alter table public.notification_outbox enable row level security;

create policy "Requesters can create access requests"
  on public.project_access_requests for insert
  with check (requester_id = auth.uid() or requester_id is null);

create policy "Requesters and owners can read access requests"
  on public.project_access_requests for select
  using (
    requester_id = auth.uid()
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

create policy "Owners can decide access requests"
  on public.project_access_requests for update
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

create policy "Requesters can withdraw their requests"
  on public.project_access_requests for delete
  using (requester_id = auth.uid());

create policy "Project members can read activity"
  on public.project_activity for select
  using (public.can_access_reclaim_project(project_id));

create policy "Editors can write activity"
  on public.project_activity for insert
  with check (public.can_edit_reclaim_project(project_id) and actor_id = auth.uid());

-- Outbox rows are not readable by normal browser clients. The future worker
-- should use a server-side secret and never expose these rows to the app.
revoke all on public.notification_outbox from anon, authenticated;

-- Queue owner notification after a new request. This only creates a row; it
-- does not attempt network access from PostgreSQL.
create or replace function public.queue_reclaim_access_request_notice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_email text;
  project_name text;
begin
  select p.name, u.email into project_name, owner_email
  from public.projects p
  join auth.users u on u.id = p.owner_id
  where p.id = new.project_id;

  if owner_email is not null then
    insert into public.notification_outbox(
      project_id, access_request_id, recipient_email, notification_type, payload
    ) values (
      new.project_id,
      new.id,
      owner_email,
      'access_request_created',
      jsonb_build_object(
        'project_name', coalesce(project_name, ''),
        'requester_name', new.requester_name,
        'requester_email', new.requester_email,
        'requested_role', new.requested_role,
        'message', new.message
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_access_request_created_reclaim on public.project_access_requests;
create trigger on_access_request_created_reclaim
after insert on public.project_access_requests
for each row execute procedure public.queue_reclaim_access_request_notice();

-- Approve or reject through one owner-checked operation. If the requester has
-- already created an account with the requested email, approval grants access
-- immediately. Otherwise the approved request remains claimable by the
-- future account-claim flow; it never grants access to an unrelated account.
create or replace function public.decide_reclaim_access_request(
  p_request_id uuid,
  p_decision text,
  p_decision_note text default ''
)
returns public.project_access_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.project_access_requests;
  target_user uuid;
begin
  select r.* into request_row
  from public.project_access_requests r
  join public.projects p on p.id = r.project_id
  where r.id = p_request_id and p.owner_id = auth.uid()
  for update;

  if request_row.id is null then
    raise exception 'Access request not found or not owned by current user';
  end if;
  if p_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  if request_row.status <> 'pending' then
    raise exception 'Access request is no longer pending';
  end if;

  if p_decision = 'approved' then
    select id into target_user from auth.users
    where lower(email) = lower(request_row.requester_email)
    limit 1;

    if target_user is not null then
      insert into public.project_members(project_id,user_id,role)
      values (request_row.project_id,target_user,request_row.requested_role)
      on conflict (project_id,user_id) do update set role=excluded.role;
    end if;
  end if;

  update public.project_access_requests
  set status=p_decision,
      decided_by=auth.uid(),
      decided_at=now(),
      decision_note=coalesce(p_decision_note,''),
      updated_at=now()
  where id=p_request_id
  returning * into request_row;

  insert into public.notification_outbox(
    project_id, access_request_id, recipient_email, notification_type, payload
  ) values (
    request_row.project_id,
    request_row.id,
    request_row.requester_email,
    'access_request_decided',
    jsonb_build_object(
      'status', request_row.status,
      'requested_role', request_row.requested_role,
      'decision_note', request_row.decision_note
    )
  );

  return request_row;
end;
$$;

grant execute on function public.decide_reclaim_access_request(uuid,text,text)
  to authenticated;

commit;
