-- ============================================================================
-- SOW Workbench — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

-- ── Profiles ────────────────────────────────────────────────────────────────
-- Extends auth.users with name, role, active flag, and stored API key.
-- Row is created via the admin-users Edge Function when an admin adds a user.

create table if not exists public.profiles (
  id        uuid        references auth.users(id) on delete cascade primary key,
  name      text        not null,
  email     text        not null,
  role      text        not null default 'growth'
              check (role in ('growth', 'pm', 'reviewer', 'admin')),
  active    boolean     not null default true,
  api_key   text,
  created_at timestamptz not null default now()
);

-- ── Opportunities ────────────────────────────────────────────────────────────
-- Stores the full opportunity object as JSONB per user.
-- id is a server-generated UUID (never set client-side).

create table if not exists public.opportunities (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── updated_at trigger ───────────────────────────────────────────────────────
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists opportunities_updated_at on public.opportunities;
create trigger opportunities_updated_at
  before update on public.opportunities
  for each row execute function public.update_updated_at();

-- ── Security definer helper (avoids RLS recursion) ──────────────────────────
-- Called inside RLS policies to check the caller's role without triggering
-- another RLS check on profiles.
create or replace function public.get_my_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.opportunities enable row level security;

-- Drop existing policies cleanly before (re-)creating
do $$ begin
  drop policy if exists "users_read_own_profile"         on public.profiles;
  drop policy if exists "users_update_own_profile"        on public.profiles;
  drop policy if exists "admins_read_all_profiles"        on public.profiles;
  drop policy if exists "admins_update_all_profiles"      on public.profiles;
  drop policy if exists "users_crud_own_opportunities"    on public.opportunities;
end $$;

-- Profiles: each user can read & update their own row
create policy "users_read_own_profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "users_update_own_profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Profiles: admins can read and update all rows
create policy "admins_read_all_profiles"
  on public.profiles for select
  using (public.get_my_role() = 'admin');

create policy "admins_update_all_profiles"
  on public.profiles for update
  using (public.get_my_role() = 'admin');

-- Opportunities: users own their rows
create policy "users_crud_own_opportunities"
  on public.opportunities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Done ─────────────────────────────────────────────────────────────────────
-- After running this script, create your first admin user:
--   1. Supabase Dashboard → Authentication → Users → Add User
--      ✓ "Auto Confirm User"
--   2. Copy the new user's UUID, then run:
--
-- insert into public.profiles (id, name, email, role)
-- values ('<paste-uuid-here>', '<your-name>', '<your-email>', 'admin');
