-- Dorm Manager database setup
-- Run the entire script in Supabase Dashboard -> SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(8),'hex'),1,8)),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key(household_id,user_id),
  unique(user_id)
);

create or replace function public.is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.household_members where household_id=hid and user_id=auth.uid()) $$;

create or replace function public.create_household(household_name text, household_location text default null)
returns uuid language plpgsql security definer set search_path=public
as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be logged in.'; end if;
  if exists(select 1 from public.household_members where user_id=auth.uid()) then raise exception 'You already belong to a household.'; end if;
  insert into public.households(name,location,owner_id) values (household_name,household_location,auth.uid()) returning id into new_id;
  insert into public.household_members(household_id,user_id,role) values(new_id,auth.uid(),'owner');
  return new_id;
end; $$;

create or replace function public.join_household(invite_code_input text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare target_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be logged in.'; end if;
  if exists(select 1 from public.household_members where user_id=auth.uid()) then raise exception 'You already belong to a household.'; end if;
  select id into target_id from public.households where invite_code=upper(trim(invite_code_input));
  if target_id is null then raise exception 'Invite code not found.'; end if;
  insert into public.household_members(household_id,user_id,role) values(target_id,auth.uid(),'member');
  return target_id;
end; $$;

create table if not exists public.chores (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 title text not null, assigned_to uuid references auth.users(id) on delete set null, due_date date, frequency text, status text not null default 'To do', notes text, completed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.events (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 title text not null, event_date timestamptz not null, location text, description text, created_at timestamptz not null default now()
);
create table if not exists public.shopping_items (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 name text not null, quantity text, added_by uuid references auth.users(id), next_buyer uuid references auth.users(id), last_bought_by uuid references auth.users(id), status text not null default 'Needed', purchased_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.shopping_purchases (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 item_name text not null, quantity text, purchased_by uuid references auth.users(id), purchased_at timestamptz not null default now()
);
create table if not exists public.moving_items (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 name text not null, category text, assigned_to uuid references auth.users(id), status text not null default 'Needed', notes text, created_at timestamptz not null default now()
);
create table if not exists public.expenses (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 description text not null, amount numeric(10,2) not null check(amount>=0), paid_by uuid references auth.users(id), category text, expense_date date not null default current_date, notes text, created_at timestamptz not null default now()
);
create table if not exists public.announcements (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 title text not null, body text not null, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.suggestions (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 title text not null, body text, anonymous boolean not null default false, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 body text not null, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.household_contacts (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 name text not null, role text, phone text, email text, notes text, created_at timestamptz not null default now()
);
create table if not exists public.wishlist_links (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 title text not null, url text not null, notes text, created_at timestamptz not null default now()
);

-- Enable row-level security and household-member access on shared data.
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;

drop policy if exists "profile read self" on public.profiles;
create policy "profile read self" on public.profiles for select using (id=auth.uid());
drop policy if exists "profile insert self" on public.profiles;
create policy "profile insert self" on public.profiles for insert with check (id=auth.uid());
drop policy if exists "profile update self" on public.profiles;
create policy "profile update self" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());

drop policy if exists "household member read" on public.households;
create policy "household member read" on public.households for select using (public.is_household_member(id));
drop policy if exists "household owner update" on public.households;
create policy "household owner update" on public.households for update using (owner_id=auth.uid()) with check (owner_id=auth.uid());

drop policy if exists "members read household" on public.household_members;
create policy "members read household" on public.household_members for select using (public.is_household_member(household_id));

-- Create membership tables via the security-definer RPCs above, not direct client inserts.
do $$
declare t text;
begin
 foreach t in array array['chores','events','shopping_items','shopping_purchases','moving_items','expenses','announcements','suggestions','messages','household_contacts','wishlist_links'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists "household members manage rows" on public.%I',t);
  execute format('create policy "household members manage rows" on public.%I for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))',t);
 end loop;
end $$;

-- Profiles are visible to members of the same household so names can be shown.
drop policy if exists "household members read profiles" on public.profiles;
create policy "household members read profiles" on public.profiles for select using (
 id=auth.uid() or exists(
  select 1 from public.household_members mine
  join public.household_members theirs on theirs.household_id=mine.household_id
  where mine.user_id=auth.uid() and theirs.user_id=profiles.id
 )
);

-- Create a profile automatically when a new auth user registers.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
 insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''));
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Optional realtime: enable for shared message and task updates.
do $$ begin
 alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_object then null; end $$;
