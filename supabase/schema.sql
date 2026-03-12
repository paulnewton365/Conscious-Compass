-- ============================================================
-- SOW WORKBENCH — SUPABASE SCHEMA
-- Run this in your Supabase project: SQL Editor → New Query
-- ============================================================

-- 1. PROFILES TABLE
--    Extends auth.users with name, role, and active status.
--    One row per user, created by the admin-users edge function.
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text        not null,
  email       text        not null,
  role        text        not null default 'growth'
                check (role in ('growth', 'pm', 'reviewer', 'admin')),
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Any logged-in user can read all profiles (needed for admin panel)
create policy "Authenticated users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- Admins can update any profile (role changes, deactivation)
create policy "Admins can update any profile"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Users can update their own name (but not role — that stays admin-only)
create policy "Users can update own name"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());


-- 2. OPPORTUNITIES TABLE
--    Stores each opportunity as a JSONB blob.
--    Simple and flexible — no schema changes needed when we add fields.
-- ============================================================
create table public.opportunities (
  id          text        primary key,
  user_id     uuid        not null references auth.users on delete cascade,
  data        jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.opportunities enable row level security;

-- Users can only see their own opportunities
create policy "Users can read own opportunities"
  on public.opportunities for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can insert own opportunities"
  on public.opportunities for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own opportunities"
  on public.opportunities for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can delete own opportunities"
  on public.opportunities for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );


-- 3. AUTO-UPDATE updated_at
-- ============================================================
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger opportunities_updated_at
  before update on public.opportunities
  for each row execute function public.update_updated_at();


-- ============================================================
-- AFTER RUNNING THIS SCHEMA:
--
-- 1. Go to Supabase → Authentication → Settings
--    → Disable "Enable email confirmations" (for internal tool)
--
-- 2. Deploy the admin-users edge function (see supabase/functions/)
--
-- 3. Create your first admin user via the edge function or
--    directly in Supabase: Authentication → Users → Add user
--    Then INSERT into profiles:
--
--    insert into public.profiles (id, name, email, role)
--    values ('<auth-user-uuid>', '<your-name>', '<your-email>', 'admin');
-- ============================================================
