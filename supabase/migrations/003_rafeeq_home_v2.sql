begin;

-- =========================================================
-- RAFEEQ Home V2
-- Run after the initial schema and 002_rafeeq_extended.sql.
-- Adds account types, the redesigned project wizard, room files,
-- design-payment records, provider requests/chat, and execution quotes.
-- =========================================================

-- 1) Account type and profile extensions
alter table public.profiles
  add column if not exists account_type text not null default 'user',
  add column if not exists company_name text,
  add column if not exists bio text,
  add column if not exists portfolio_url text,
  add column if not exists is_verified boolean not null default false;

alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('user','interior_designer','company','engineering_office'));

-- Keep admin authorization separate from the account type chosen by the user.
create or replace function private.has_account_type(allowed_types text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and account_type = any(allowed_types)
  );
$$;

revoke all on function private.has_account_type(text[]) from public;
grant execute on function private.has_account_type(text[]) to authenticated;

-- 2) Project wizard fields
alter table public.projects
  add column if not exists governorate text,
  add column if not exists project_scope text default 'single_room',
  add column if not exists room_area numeric(10,2),
  add column if not exists profession text,
  add column if not exists current_step integer not null default 0,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists service_price numeric(14,2),
  add column if not exists paid_at timestamptz,
  add column if not exists design_status text not null default 'draft';

alter table public.projects drop constraint if exists projects_scope_check;
alter table public.projects
  add constraint projects_scope_check
  check (project_scope in ('single_room','full_apartment'));

alter table public.projects drop constraint if exists projects_payment_status_check;
alter table public.projects
  add constraint projects_payment_status_check
  check (payment_status in ('unpaid','pending','paid','failed','refunded'));

alter table public.projects drop constraint if exists projects_design_status_check;
alter table public.projects
  add constraint projects_design_status_check
  check (design_status in ('draft','queued','processing','completed','failed'));

-- Old fields remain nullable for backwards compatibility, but V2 no longer uses them.

-- 3) Independent file per room, including full-apartment projects
create table if not exists public.project_rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  room_key text not null,
  room_type text not null,
  title text not null,
  area_sqm numeric(10,2) check (area_sqm is null or area_sqm > 0),
  sort_order integer not null default 0,
  original_image_url text,
  final_design_url text,
  panorama_url text,
  palette text[] not null default '{}',
  furniture_data jsonb not null default '[]'::jsonb,
  room_cost numeric(14,2),
  design_status text not null default 'draft',
  confidence_score numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, room_key)
);

alter table public.project_rooms drop constraint if exists project_rooms_design_status_check;
alter table public.project_rooms
  add constraint project_rooms_design_status_check
  check (design_status in ('draft','queued','processing','completed','failed'));

alter table public.project_images
  add column if not exists room_id uuid references public.project_rooms(id) on delete cascade;

create index if not exists project_rooms_project_id_idx on public.project_rooms(project_id, sort_order);
create index if not exists project_rooms_user_id_idx on public.project_rooms(user_id);
create index if not exists project_images_room_id_idx on public.project_images(room_id);

drop trigger if exists project_rooms_set_updated_at on public.project_rooms;
create trigger project_rooms_set_updated_at
before update on public.project_rooms
for each row execute function private.set_updated_at();

-- 4) Design-service payment records. Never store the full card number or CVV.
create table if not exists public.project_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'EGP',
  method text not null default 'visa',
  status text not null default 'pending',
  payment_reference text not null unique,
  card_last4 text,
  created_at timestamptz not null default now()
);

alter table public.project_payments drop constraint if exists project_payments_status_check;
alter table public.project_payments
  add constraint project_payments_status_check
  check (status in ('pending','paid','failed','refunded'));

alter table public.project_payments drop constraint if exists project_payments_method_check;
alter table public.project_payments
  add constraint project_payments_method_check
  check (method = 'visa');

create index if not exists project_payments_project_id_idx on public.project_payments(project_id);
create index if not exists project_payments_user_id_idx on public.project_payments(user_id, created_at desc);

-- 5) Product details required by the interactive design and nearest-branch flow
alter table public.products
  add column if not exists supplier_id uuid references auth.users(id) on delete set null,
  add column if not exists supplier_name text,
  add column if not exists dimensions text,
  add column if not exists available_colors text[] not null default '{}',
  add column if not exists gallery text[] not null default '{}',
  add column if not exists panorama_url text,
  add column if not exists branches jsonb not null default '[]'::jsonb,
  add column if not exists view_count integer not null default 0,
  add column if not exists sales_count integer not null default 0;

create index if not exists products_supplier_id_idx on public.products(supplier_id);
create index if not exists products_view_count_idx on public.products(view_count desc);
create index if not exists products_sales_count_idx on public.products(sales_count desc);

-- 6) Contact requests, atomic acceptance, attachments, and messages
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  description text not null,
  budget numeric(14,2),
  requested_date date,
  target_type text not null default 'both',
  status text not null default 'pending',
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_requests drop constraint if exists service_requests_target_type_check;
alter table public.service_requests
  add constraint service_requests_target_type_check
  check (target_type in ('both','interior_designer','engineering_office'));

alter table public.service_requests drop constraint if exists service_requests_status_check;
alter table public.service_requests
  add constraint service_requests_status_check
  check (status in ('pending','accepted','in_progress','completed','cancelled'));


create table if not exists public.service_request_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('rejected','accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id, provider_id)
);

create index if not exists service_request_responses_provider_idx on public.service_request_responses(provider_id, status);

drop trigger if exists service_request_responses_set_updated_at on public.service_request_responses;
create trigger service_request_responses_set_updated_at
before update on public.service_request_responses
for each row execute function private.set_updated_at();

create table if not exists public.service_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  path text not null,
  size bigint,
  type text,
  created_at timestamptz not null default now()
);

create table if not exists public.service_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text,
  file_name text,
  file_path text,
  created_at timestamptz not null default now(),
  check (message is not null or file_path is not null or file_name is not null)
);

create index if not exists service_requests_customer_id_idx on public.service_requests(customer_id, created_at desc);
create index if not exists service_requests_status_idx on public.service_requests(status, target_type, created_at desc);
create index if not exists service_requests_accepted_by_idx on public.service_requests(accepted_by, created_at desc);
create index if not exists service_messages_request_id_idx on public.service_messages(request_id, created_at);
create index if not exists service_attachments_request_id_idx on public.service_request_attachments(request_id);

drop trigger if exists service_requests_set_updated_at on public.service_requests;
create trigger service_requests_set_updated_at
before update on public.service_requests
for each row execute function private.set_updated_at();

create or replace function private.validate_service_request_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_type text;
begin
  if (select private.is_admin()) then
    return new;
  end if;

  select account_type into caller_type
  from public.profiles
  where id = caller_id;

  -- The customer can only cancel a request that is still pending.
  if old.customer_id = caller_id then
    if new.status = 'cancelled'
       and old.status = 'pending'
       and new.accepted_by is not distinct from old.accepted_by then
      return new;
    end if;
    raise exception 'Customer cannot perform this request update';
  end if;

  -- A matching provider can atomically accept an available request.
  if caller_type in ('interior_designer','engineering_office')
     and old.status = 'pending'
     and new.status = 'accepted'
     and new.accepted_by = caller_id
     and (old.target_type = 'both' or old.target_type = caller_type) then
    return new;
  end if;

  -- The accepted provider can advance the execution state only.
  if old.accepted_by = caller_id
     and new.accepted_by is not distinct from old.accepted_by
     and (
       (old.status = 'accepted' and new.status in ('in_progress','completed'))
       or (old.status = 'in_progress' and new.status = 'completed')
     ) then
    return new;
  end if;

  raise exception 'Invalid service request transition';
end;
$$;

drop trigger if exists validate_service_request_update on public.service_requests;
create trigger validate_service_request_update
before update on public.service_requests
for each row execute function private.validate_service_request_update();

create or replace function public.accept_service_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_type text;
  accepted_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select account_type into caller_type
  from public.profiles
  where id = caller_id;

  if caller_type not in ('interior_designer','engineering_office') then
    raise exception 'Only designers and engineering offices can accept requests';
  end if;

  update public.service_requests
  set status = 'accepted',
      accepted_by = caller_id,
      accepted_at = now(),
      updated_at = now()
  where id = p_request_id
    and status = 'pending'
    and (target_type = 'both' or target_type = caller_type)
  returning id into accepted_id;

  if accepted_id is null then
    raise exception 'Request is no longer available';
  end if;

  insert into public.service_request_responses (request_id, provider_id, status)
  values (accepted_id, caller_id, 'accepted')
  on conflict (request_id, provider_id)
  do update set status = excluded.status, updated_at = now();

  insert into public.notifications (user_id, title, body, type)
  select customer_id,
         'تم قبول طلبك',
         'قبل أحد مقدمي الخدمة طلبك وتم فتح المحادثة الخاصة.',
         'service_request'
  from public.service_requests
  where id = accepted_id;

  return accepted_id;
end;
$$;

revoke all on function public.accept_service_request(uuid) from public;
grant execute on function public.accept_service_request(uuid) to authenticated;

-- 7) Office quotations and final execution cost
create table if not exists public.office_quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  office_id uuid not null references auth.users(id) on delete cascade,
  execution_cost numeric(14,2) not null check (execution_cost >= 0),
  additional_fees numeric(14,2) not null default 0 check (additional_fees >= 0),
  expected_duration_days integer check (expected_duration_days is null or expected_duration_days > 0),
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, office_id)
);

create index if not exists office_quotes_project_id_idx on public.office_quotes(project_id);
create index if not exists office_quotes_office_id_idx on public.office_quotes(office_id);

drop trigger if exists office_quotes_set_updated_at on public.office_quotes;
create trigger office_quotes_set_updated_at
before update on public.office_quotes
for each row execute function private.set_updated_at();

-- 8) Design version history for AI chat modifications
create table if not exists public.design_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  room_id uuid references public.project_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null,
  prompt text,
  image_url text,
  design_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(project_id, room_id, version_number)
);

create index if not exists design_versions_project_id_idx on public.design_versions(project_id, created_at desc);

-- 9) Updated user trigger with a safe whitelist for account_type
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_role public.app_role;
  selected_account_type text;
begin
  selected_role :=
    case
      when lower(new.email) = 'nerovirusismail@gmail.com'
        then 'admin'::public.app_role
      else 'customer'::public.app_role
    end;

  selected_account_type :=
    case new.raw_user_meta_data ->> 'account_type'
      when 'interior_designer' then 'interior_designer'
      when 'company' then 'company'
      when 'engineering_office' then 'engineering_office'
      else 'user'
    end;

  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    account_type
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    lower(new.email),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    selected_role,
    selected_account_type
  )
  on conflict (id)
  do update set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone),
    account_type = coalesce(public.profiles.account_type, excluded.account_type),
    role = case
      when excluded.email = 'nerovirusismail@gmail.com'
        then 'admin'::public.app_role
      else public.profiles.role
    end;

  return new;
end;
$$;

-- 10) RLS
alter table public.project_rooms enable row level security;
alter table public.project_payments enable row level security;
alter table public.service_requests enable row level security;
alter table public.service_request_responses enable row level security;
alter table public.service_request_attachments enable row level security;
alter table public.service_messages enable row level security;
alter table public.office_quotes enable row level security;
alter table public.design_versions enable row level security;

-- Remove V2 policies before recreating them so the migration can be rerun safely.
drop policy if exists "project_rooms_select_own" on public.project_rooms;
drop policy if exists "project_rooms_insert_own" on public.project_rooms;
drop policy if exists "project_rooms_update_own" on public.project_rooms;
drop policy if exists "project_rooms_delete_own" on public.project_rooms;
drop policy if exists "project_payments_select_own" on public.project_payments;
drop policy if exists "project_payments_insert_own" on public.project_payments;
drop policy if exists "service_requests_customer_insert" on public.service_requests;
drop policy if exists "service_requests_participant_select" on public.service_requests;
drop policy if exists "service_requests_customer_update" on public.service_requests;
drop policy if exists "service_request_responses_select_own" on public.service_request_responses;
drop policy if exists "service_request_responses_insert_own" on public.service_request_responses;
drop policy if exists "service_request_responses_update_own" on public.service_request_responses;
drop policy if exists "service_attachments_participant_select" on public.service_request_attachments;
drop policy if exists "service_attachments_participant_insert" on public.service_request_attachments;
drop policy if exists "service_messages_participant_select" on public.service_messages;
drop policy if exists "service_messages_participant_insert" on public.service_messages;
drop policy if exists "office_quotes_participant_select" on public.office_quotes;
drop policy if exists "office_quotes_office_insert" on public.office_quotes;
drop policy if exists "office_quotes_office_update" on public.office_quotes;
drop policy if exists "design_versions_select_own" on public.design_versions;
drop policy if exists "design_versions_insert_own" on public.design_versions;
drop policy if exists "products_company_insert" on public.products;
drop policy if exists "products_company_update" on public.products;
drop policy if exists "products_company_delete" on public.products;

-- Project rooms
create policy "project_rooms_select_own"
on public.project_rooms for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "project_rooms_insert_own"
on public.project_rooms for insert to authenticated
with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "project_rooms_update_own"
on public.project_rooms for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "project_rooms_delete_own"
on public.project_rooms for delete to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Project payments (client-side insert is for the current UI demo only)
create policy "project_payments_select_own"
on public.project_payments for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "project_payments_insert_own"
on public.project_payments for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.projects
    where projects.id = project_payments.project_id
      and projects.user_id = (select auth.uid())
  )
);

-- Service requests
create policy "service_requests_customer_insert"
on public.service_requests for insert to authenticated
with check (customer_id = (select auth.uid()));
create policy "service_requests_participant_select"
on public.service_requests for select to authenticated
using (
  customer_id = (select auth.uid())
  or accepted_by = (select auth.uid())
  or (
    status = 'pending'
    and (
      (target_type = 'both' and (select private.has_account_type(array['interior_designer','engineering_office'])))
      or (target_type = 'interior_designer' and (select private.has_account_type(array['interior_designer'])))
      or (target_type = 'engineering_office' and (select private.has_account_type(array['engineering_office'])))
    )
  )
  or (select private.is_admin())
);
create policy "service_requests_customer_update"
on public.service_requests for update to authenticated
using (customer_id = (select auth.uid()) or accepted_by = (select auth.uid()) or (select private.is_admin()))
with check (customer_id = (select auth.uid()) or accepted_by = (select auth.uid()) or (select private.is_admin()));


-- Provider accept/reject responses
create policy "service_request_responses_select_own"
on public.service_request_responses for select to authenticated
using (provider_id = (select auth.uid()) or (select private.is_admin()));
create policy "service_request_responses_insert_own"
on public.service_request_responses for insert to authenticated
with check (
  provider_id = (select auth.uid())
  and (select private.has_account_type(array['interior_designer','engineering_office']))
);
create policy "service_request_responses_update_own"
on public.service_request_responses for update to authenticated
using (provider_id = (select auth.uid()) or (select private.is_admin()))
with check (provider_id = (select auth.uid()) or (select private.is_admin()));

-- Attachments
create policy "service_attachments_participant_select"
on public.service_request_attachments for select to authenticated
using (
  exists (
    select 1 from public.service_requests
    where service_requests.id = service_request_attachments.request_id
      and (
        service_requests.customer_id = (select auth.uid())
        or service_requests.accepted_by = (select auth.uid())
        or (select private.is_admin())
      )
  )
);
create policy "service_attachments_participant_insert"
on public.service_request_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1 from public.service_requests
    where service_requests.id = service_request_attachments.request_id
      and (
        service_requests.customer_id = (select auth.uid())
        or service_requests.accepted_by = (select auth.uid())
      )
  )
);

-- Messages
create policy "service_messages_participant_select"
on public.service_messages for select to authenticated
using (
  exists (
    select 1 from public.service_requests
    where service_requests.id = service_messages.request_id
      and (
        service_requests.customer_id = (select auth.uid())
        or service_requests.accepted_by = (select auth.uid())
        or (select private.is_admin())
      )
  )
);
create policy "service_messages_participant_insert"
on public.service_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.service_requests
    where service_requests.id = service_messages.request_id
      and service_requests.status in ('accepted','in_progress','completed')
      and (
        service_requests.customer_id = (select auth.uid())
        or service_requests.accepted_by = (select auth.uid())
      )
  )
);

-- Office quotes
create policy "office_quotes_participant_select"
on public.office_quotes for select to authenticated
using (
  office_id = (select auth.uid())
  or exists (
    select 1 from public.projects
    where projects.id = office_quotes.project_id
      and projects.user_id = (select auth.uid())
  )
  or (select private.is_admin())
);
create policy "office_quotes_office_insert"
on public.office_quotes for insert to authenticated
with check (office_id = (select auth.uid()) and (select private.has_account_type(array['engineering_office'])));
create policy "office_quotes_office_update"
on public.office_quotes for update to authenticated
using (office_id = (select auth.uid()) or (select private.is_admin()))
with check (office_id = (select auth.uid()) or (select private.is_admin()));

-- Design versions
create policy "design_versions_select_own"
on public.design_versions for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "design_versions_insert_own"
on public.design_versions for insert to authenticated
with check (user_id = (select auth.uid()) or (select private.is_admin()));

-- Company product management
create policy "products_company_insert"
on public.products for insert to authenticated
with check (supplier_id = (select auth.uid()) and (select private.has_account_type(array['company'])));
create policy "products_company_update"
on public.products for update to authenticated
using (supplier_id = (select auth.uid()) and (select private.has_account_type(array['company'])))
with check (supplier_id = (select auth.uid()) and (select private.has_account_type(array['company'])));
create policy "products_company_delete"
on public.products for delete to authenticated
using (supplier_id = (select auth.uid()) and (select private.has_account_type(array['company'])));

-- 11) Grants
revoke all on public.project_rooms, public.project_payments, public.service_requests,
  public.service_request_responses, public.service_request_attachments, public.service_messages, public.office_quotes,
  public.design_versions from anon, authenticated;

grant select, insert, update, delete on public.project_rooms to authenticated;
grant select, insert on public.project_payments to authenticated;
grant select, insert on public.service_requests to authenticated;
grant update (status) on public.service_requests to authenticated;
grant select, insert, update on public.service_request_responses to authenticated;
grant select, insert on public.service_request_attachments to authenticated;
grant select, insert on public.service_messages to authenticated;
grant select, insert, update on public.office_quotes to authenticated;
grant select, insert on public.design_versions to authenticated;

grant update (account_type, company_name, bio, portfolio_url) on public.profiles to authenticated;

-- 12) Private request-files bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-files',
  'request-files',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

drop policy if exists "request_files_insert_own" on storage.objects;
drop policy if exists "request_files_select_authenticated" on storage.objects;
drop policy if exists "request_files_select_participants" on storage.objects;

create policy "request_files_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'request-files'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

create policy "request_files_select_participants"
on storage.objects for select to authenticated
using (
  bucket_id = 'request-files'
  and exists (
    select 1
    from public.service_requests
    where service_requests.id::text = (storage.foldername(name))[1]
      and (
        service_requests.customer_id = (select auth.uid())
        or service_requests.accepted_by = (select auth.uid())
        or (select private.is_admin())
      )
  )
);

commit;
