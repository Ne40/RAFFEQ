
begin;

-- RAFEEQ extended application schema.
-- Run this after the initial profiles/projects/project_activity migration.

alter type public.project_status add value if not exists 'generating';

alter table public.projects
  add column if not exists property_type text,
  add column if not exists country text,
  add column if not exists room_width numeric(8,2),
  add column if not exists room_length numeric(8,2),
  add column if not exists room_height numeric(8,2),
  add column if not exists style text,
  add column if not exists favorite_colors text[] not null default '{}',
  add column if not exists min_budget numeric(14,2),
  add column if not exists max_budget numeric(14,2),
  add column if not exists requirements jsonb not null default '{}'::jsonb,
  add column if not exists notes text,
  add column if not exists cover_image_url text,
  add column if not exists ai_result_url text,
  add column if not exists confidence_score numeric(5,2);

alter table public.projects
  drop constraint if exists projects_budget_range_check;

alter table public.projects
  add constraint projects_budget_range_check
  check (
    min_budget is null
    or max_budget is null
    or max_budget >= min_budget
  );

create table if not exists public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  image_type text not null default 'room',
  created_at timestamptz not null default now()
);

create table if not exists public.saved_designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  image_url text,
  style text,
  design_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  description text,
  category text not null,
  price numeric(14,2) not null check (price >= 0),
  rating numeric(3,2) not null default 0 check (rating between 0 and 5),
  image_url text,
  material text,
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  create type public.order_status as enum (
    'pending',
    'confirmed',
    'preparing',
    'shipped',
    'delivered',
    'cancelled'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_number text not null unique,
  total_amount numeric(14,2) not null check (total_amount >= 0),
  shipping_address jsonb not null default '{}'::jsonb,
  payment_method text not null,
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_ref text,
  product_name text not null,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'general',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists project_images_project_id_idx on public.project_images(project_id);
create index if not exists saved_designs_user_id_idx on public.saved_designs(user_id);
create index if not exists products_category_idx on public.products(category);
create index if not exists products_active_idx on public.products(is_active);
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id, created_at desc);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function private.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function private.set_updated_at();

-- Keep phone metadata when a user is created through email or Google.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_role public.app_role;
begin
  selected_role :=
    case
      when lower(new.email) = 'nerovirusismail@gmail.com'
        then 'admin'::public.app_role
      else 'customer'::public.app_role
    end;

  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    role
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
    selected_role
  )
  on conflict (id)
  do update set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone),
    role = case
      when excluded.email = 'nerovirusismail@gmail.com'
        then 'admin'::public.app_role
      else public.profiles.role
    end;

  return new;
end;
$$;

alter table public.project_images enable row level security;
alter table public.saved_designs enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "project_images_select_own" on public.project_images;
drop policy if exists "project_images_insert_own" on public.project_images;
drop policy if exists "project_images_delete_own" on public.project_images;
create policy "project_images_select_own"
on public.project_images for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "project_images_insert_own"
on public.project_images for insert to authenticated
with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "project_images_delete_own"
on public.project_images for delete to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "saved_designs_select_own" on public.saved_designs;
drop policy if exists "saved_designs_insert_own" on public.saved_designs;
drop policy if exists "saved_designs_update_own" on public.saved_designs;
drop policy if exists "saved_designs_delete_own" on public.saved_designs;
create policy "saved_designs_select_own"
on public.saved_designs for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "saved_designs_insert_own"
on public.saved_designs for insert to authenticated
with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "saved_designs_update_own"
on public.saved_designs for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()))
with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "saved_designs_delete_own"
on public.saved_designs for delete to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "products_public_read" on public.products;
drop policy if exists "products_admin_all" on public.products;
create policy "products_public_read"
on public.products for select to anon, authenticated
using (is_active = true);
create policy "products_admin_all"
on public.products for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "orders_select_own" on public.orders;
drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_select_own"
on public.orders for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "orders_insert_own"
on public.orders for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "orders_update_admin"
on public.orders for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "order_items_select_own" on public.order_items;
drop policy if exists "order_items_insert_own" on public.order_items;
create policy "order_items_select_own"
on public.order_items for select to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and (orders.user_id = (select auth.uid()) or (select private.is_admin()))
  )
);
create policy "order_items_insert_own"
on public.order_items for insert to authenticated
with check (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = (select auth.uid())
  )
);

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "notifications_update_own"
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on public.project_images, public.saved_designs, public.products,
  public.orders, public.order_items, public.notifications
from anon, authenticated;

grant select on public.products to anon, authenticated;
grant select, insert, delete on public.project_images to authenticated;
grant select, insert, update, delete on public.saved_designs to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert on public.order_items to authenticated;
grant select, update on public.notifications to authenticated;

-- Optional private storage bucket for original room images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'room-images',
  'room-images',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

drop policy if exists "room_images_storage_select" on storage.objects;
drop policy if exists "room_images_storage_insert" on storage.objects;
drop policy if exists "room_images_storage_delete" on storage.objects;

create policy "room_images_storage_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'room-images'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_admin())
  )
);

create policy "room_images_storage_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'room-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "room_images_storage_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'room-images'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_admin())
  )
);

commit;
