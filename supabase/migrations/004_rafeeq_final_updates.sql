begin;

-- =========================================================
-- RAFEEQ Final Updates
-- Run after 001 initial schema, 002_rafeeq_extended.sql,
-- and 003_rafeeq_home_v2.sql.
-- =========================================================

-- 1) Profile fields for free trial and provider dashboards
alter table public.profiles
  add column if not exists free_design_used boolean not null default false,
  add column if not exists free_ai_messages_used integer not null default 0,
  add column if not exists free_ai_edits_used integer not null default 0,
  add column if not exists experience_years integer,
  add column if not exists specialization text,
  add column if not exists expertise_styles text[] not null default '{}',
  add column if not exists service_governorates text[] not null default '{}',
  add column if not exists address text,
  add column if not exists work_hours text,
  add column if not exists logo_url text,
  add column if not exists social_links jsonb not null default '{}'::jsonb;

alter table public.profiles drop constraint if exists profiles_free_ai_messages_check;
alter table public.profiles add constraint profiles_free_ai_messages_check
  check (free_ai_messages_used between 0 and 4);

alter table public.profiles drop constraint if exists profiles_free_ai_edits_check;
alter table public.profiles add constraint profiles_free_ai_edits_check
  check (free_ai_edits_used between 0 and 1);

alter table public.profiles drop constraint if exists profiles_experience_years_check;
alter table public.profiles add constraint profiles_experience_years_check
  check (experience_years is null or experience_years between 0 and 80);

-- 2) Project access tier and trial payment state
alter table public.projects
  add column if not exists access_tier text not null default 'none';

alter table public.projects drop constraint if exists projects_access_tier_check;
alter table public.projects add constraint projects_access_tier_check
  check (access_tier in ('none','trial','paid'));

alter table public.projects drop constraint if exists projects_payment_status_check;
alter table public.projects add constraint projects_payment_status_check
  check (payment_status in ('unpaid','pending','trial','paid','failed','refunded'));


-- Allow room images up to 7 MB and keep the required formats.
update storage.buckets
set
  file_size_limit = 7340032,
  allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'room-images';

-- 3) Atomic free-trial claim. A user cannot claim it twice.
create or replace function public.claim_free_design(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_count integer;
begin
  update public.profiles
  set
    free_design_used = true,
    free_ai_messages_used = 0,
    free_ai_edits_used = 0,
    updated_at = now()
  where id = (select auth.uid())
    and free_design_used = false;

  get diagnostics claimed_count = row_count;

  if claimed_count = 0 then
    return false;
  end if;

  update public.projects
  set
    payment_status = 'trial',
    access_tier = 'trial',
    service_price = 0,
    current_step = 10,
    status = 'active',
    updated_at = now()
  where id = p_project_id
    and user_id = (select auth.uid());

  if not found then
    raise exception 'Project not found or not owned by the current user';
  end if;

  return true;
end;
$$;

revoke all on function public.claim_free_design(uuid) from public;
grant execute on function public.claim_free_design(uuid) to authenticated;

-- 4) Atomic free AI usage counters
create or replace function public.consume_free_ai(p_is_edit boolean default false)
returns table (
  allowed boolean,
  messages_used integer,
  edits_used integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_messages integer;
  current_edits integer;
begin
  select free_ai_messages_used, free_ai_edits_used
  into current_messages, current_edits
  from public.profiles
  where id = (select auth.uid())
    and free_design_used = true
  for update;

  if not found then
    return query select false, 0, 0;
    return;
  end if;

  if current_messages >= 4 or (p_is_edit and current_edits >= 1) then
    return query select false, current_messages, current_edits;
    return;
  end if;

  update public.profiles
  set
    free_ai_messages_used = free_ai_messages_used + 1,
    free_ai_edits_used = free_ai_edits_used + case when p_is_edit then 1 else 0 end,
    updated_at = now()
  where id = (select auth.uid())
  returning free_ai_messages_used, free_ai_edits_used
  into current_messages, current_edits;

  return query select true, current_messages, current_edits;
end;
$$;

revoke all on function public.consume_free_ai(boolean) from public;
grant execute on function public.consume_free_ai(boolean) to authenticated;

-- 5) Provider schedules
create table if not exists public.provider_schedules (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  event_type text not null default 'meeting',
  project_id uuid references public.projects(id) on delete set null,
  customer_id uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  notes text,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.provider_schedules drop constraint if exists provider_schedules_type_check;
alter table public.provider_schedules add constraint provider_schedules_type_check
  check (event_type in ('meeting','inspection','visit','execution','delivery','review'));

alter table public.provider_schedules drop constraint if exists provider_schedules_status_check;
alter table public.provider_schedules add constraint provider_schedules_status_check
  check (status in ('scheduled','completed','cancelled'));

-- 6) Engineering team
create table if not exists public.provider_team_members (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  job_title text not null,
  phone text,
  email text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_tasks (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid references public.provider_team_members(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.provider_tasks drop constraint if exists provider_tasks_status_check;
alter table public.provider_tasks add constraint provider_tasks_status_check
  check (status in ('pending','in_progress','completed','cancelled'));

-- 7) Designer portfolio
create table if not exists public.designer_portfolio (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  project_type text,
  style text,
  completed_at date,
  cover_image_url text,
  gallery text[] not null default '{}',
  description text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8) Provider reviews and earnings/payments
create table if not exists public.provider_reviews (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  provider_reply text,
  created_at timestamptz not null default now(),
  replied_at timestamptz
);

create table if not exists public.provider_payments (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  amount numeric(14,2) not null check (amount >= 0),
  payment_type text not null default 'earning',
  status text not null default 'pending',
  invoice_number text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.provider_payments drop constraint if exists provider_payments_type_check;
alter table public.provider_payments add constraint provider_payments_type_check
  check (payment_type in ('earning','project_payment','commission','payout'));

alter table public.provider_payments drop constraint if exists provider_payments_status_check;
alter table public.provider_payments add constraint provider_payments_status_check
  check (status in ('pending','paid','failed','refunded'));

-- 9) Execution progress updates with before/during/after images
create table if not exists public.project_progress_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  office_id uuid not null references auth.users(id) on delete cascade,
  stage text not null,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  notes text,
  image_urls text[] not null default '{}',
  shared_with_customer boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.project_progress_updates drop constraint if exists project_progress_stage_check;
alter table public.project_progress_updates add constraint project_progress_stage_check
  check (stage in ('before','during','after'));

-- 10) Company AI insights and QR analytics
create table if not exists public.company_ai_insights (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  insight_type text not null,
  title text not null,
  description text not null,
  metric_value numeric(14,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.company_qr_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  branch_id text,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  created_at timestamptz not null default now()
);

alter table public.company_qr_events drop constraint if exists company_qr_event_type_check;
alter table public.company_qr_events add constraint company_qr_event_type_check
  check (event_type in ('scan','branch_visit','purchase'));

-- 11) Triggers and indexes
drop trigger if exists provider_schedules_set_updated_at on public.provider_schedules;
create trigger provider_schedules_set_updated_at before update on public.provider_schedules
for each row execute function private.set_updated_at();

drop trigger if exists provider_team_members_set_updated_at on public.provider_team_members;
create trigger provider_team_members_set_updated_at before update on public.provider_team_members
for each row execute function private.set_updated_at();

drop trigger if exists provider_tasks_set_updated_at on public.provider_tasks;
create trigger provider_tasks_set_updated_at before update on public.provider_tasks
for each row execute function private.set_updated_at();

drop trigger if exists designer_portfolio_set_updated_at on public.designer_portfolio;
create trigger designer_portfolio_set_updated_at before update on public.designer_portfolio
for each row execute function private.set_updated_at();

create index if not exists provider_schedules_provider_idx on public.provider_schedules(provider_id, starts_at);
create index if not exists provider_team_members_provider_idx on public.provider_team_members(provider_id, is_active);
create index if not exists provider_tasks_provider_idx on public.provider_tasks(provider_id, status, due_at);
create index if not exists designer_portfolio_designer_idx on public.designer_portfolio(designer_id, created_at desc);
create index if not exists provider_reviews_provider_idx on public.provider_reviews(provider_id, created_at desc);
create index if not exists provider_payments_provider_idx on public.provider_payments(provider_id, status, created_at desc);
create index if not exists project_progress_project_idx on public.project_progress_updates(project_id, created_at desc);
create index if not exists company_ai_insights_company_idx on public.company_ai_insights(company_id, created_at desc);
create index if not exists company_qr_events_company_idx on public.company_qr_events(company_id, event_type, created_at desc);

-- 12) RLS
alter table public.provider_schedules enable row level security;
alter table public.provider_team_members enable row level security;
alter table public.provider_tasks enable row level security;
alter table public.designer_portfolio enable row level security;
alter table public.provider_reviews enable row level security;
alter table public.provider_payments enable row level security;
alter table public.project_progress_updates enable row level security;
alter table public.company_ai_insights enable row level security;
alter table public.company_qr_events enable row level security;

-- Provider-owned tables
create policy "provider_schedules_owner_all" on public.provider_schedules
for all to authenticated
using (provider_id = (select auth.uid()) or (select private.is_admin()))
with check (provider_id = (select auth.uid()) or (select private.is_admin()));

create policy "provider_team_owner_all" on public.provider_team_members
for all to authenticated
using (provider_id = (select auth.uid()) or (select private.is_admin()))
with check (provider_id = (select auth.uid()) or (select private.is_admin()));

create policy "provider_tasks_owner_all" on public.provider_tasks
for all to authenticated
using (provider_id = (select auth.uid()) or (select private.is_admin()))
with check (provider_id = (select auth.uid()) or (select private.is_admin()));

create policy "designer_portfolio_public_select" on public.designer_portfolio
for select to authenticated
using (is_published or designer_id = (select auth.uid()) or (select private.is_admin()));

create policy "designer_portfolio_owner_write" on public.designer_portfolio
for all to authenticated
using (designer_id = (select auth.uid()) or (select private.is_admin()))
with check (designer_id = (select auth.uid()) or (select private.is_admin()));

create policy "provider_reviews_participant_select" on public.provider_reviews
for select to authenticated
using (
  provider_id = (select auth.uid())
  or customer_id = (select auth.uid())
  or (select private.is_admin())
);

create policy "provider_reviews_customer_insert" on public.provider_reviews
for insert to authenticated
with check (customer_id = (select auth.uid()));

create policy "provider_reviews_provider_update" on public.provider_reviews
for update to authenticated
using (provider_id = (select auth.uid()) or (select private.is_admin()))
with check (provider_id = (select auth.uid()) or (select private.is_admin()));

create policy "provider_payments_owner_select" on public.provider_payments
for select to authenticated
using (provider_id = (select auth.uid()) or (select private.is_admin()));

create policy "project_progress_participant_select" on public.project_progress_updates
for select to authenticated
using (
  office_id = (select auth.uid())
  or exists (
    select 1 from public.projects
    where projects.id = project_progress_updates.project_id
      and projects.user_id = (select auth.uid())
  )
  or (select private.is_admin())
);

create policy "project_progress_office_write" on public.project_progress_updates
for all to authenticated
using (office_id = (select auth.uid()) or (select private.is_admin()))
with check (office_id = (select auth.uid()) or (select private.is_admin()));

create policy "company_ai_insights_owner_select" on public.company_ai_insights
for select to authenticated
using (company_id = (select auth.uid()) or (select private.is_admin()));

create policy "company_qr_events_owner_select" on public.company_qr_events
for select to authenticated
using (company_id = (select auth.uid()) or (select private.is_admin()));

-- QR scans can be recorded by authenticated users for active products.
create policy "company_qr_events_authenticated_insert" on public.company_qr_events
for insert to authenticated
with check (user_id is null or user_id = (select auth.uid()));

-- 13) Grants
revoke all on public.provider_schedules, public.provider_team_members, public.provider_tasks,
  public.designer_portfolio, public.provider_reviews, public.provider_payments,
  public.project_progress_updates, public.company_ai_insights, public.company_qr_events
from anon, authenticated;

grant select, insert, update, delete on public.provider_schedules to authenticated;
grant select, insert, update, delete on public.provider_team_members to authenticated;
grant select, insert, update, delete on public.provider_tasks to authenticated;
grant select, insert, update, delete on public.designer_portfolio to authenticated;
grant select, insert, update on public.provider_reviews to authenticated;
grant select on public.provider_payments to authenticated;
grant select, insert, update, delete on public.project_progress_updates to authenticated;
grant select on public.company_ai_insights to authenticated;
grant select, insert on public.company_qr_events to authenticated;

grant update (
  experience_years,
  specialization,
  expertise_styles,
  service_governorates,
  address,
  work_hours,
  logo_url,
  social_links
) on public.profiles to authenticated;

commit;
