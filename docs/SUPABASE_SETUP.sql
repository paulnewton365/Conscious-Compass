-- ─────────────────────────────────────────────────────────────
-- Conscious Compass — complete Supabase setup
--
-- Run the whole file in the Supabase SQL Editor (Database → SQL Editor).
--
-- SAFE TO RUN ON A LIVE DATABASE. Every statement is idempotent: tables use
-- CREATE TABLE IF NOT EXISTS, columns use ADD COLUMN IF NOT EXISTS, policies
-- are dropped and recreated. Running it twice changes nothing the second time.
-- It creates no data and drops no data.
--
-- This file supersedes supabase-schema.sql and both files in docs/. Those
-- left the cache tables and several columns commented out as instructions,
-- so a fresh deploy from them produced a database the app could not use.
--
-- Verify afterwards with docs/SUPABASE_VERIFY.sql.
-- ─────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════
-- 1. PROFILES — user accounts, approval and roles
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  is_admin    boolean default false,
  is_approved boolean default false,
  is_readonly boolean default false,
  last_login  timestamptz,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Columns added after the original schema shipped.
alter table public.profiles add column if not exists is_readonly boolean default false;
alter table public.profiles add column if not exists last_login  timestamptz;

-- Deleting an auth user must remove their profile. Without this, admin user
-- deletion fails on a foreign key violation.
do $$
begin
  if exists (
    select 1 from information_schema.referential_constraints
    where constraint_name = 'profiles_id_fkey'
      and delete_rule <> 'CASCADE'
  ) then
    alter table public.profiles drop constraint profiles_id_fkey;
    alter table public.profiles add constraint profiles_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 2. COMPASS_RESULTS — summary rows behind Results, Compare, Landscape
-- ═══════════════════════════════════════════════════════════════
--
-- campaign level, footprint levels and the challenge summary all ride inside
-- the scores JSONB rather than as columns, so they need no migration as the
-- framework grows. assessor_name and rubric_version WERE being written by the
-- app but were missing from the schema file: if your live database already
-- has them these two lines are no-ops.

create table if not exists public.compass_results (
  id                   uuid primary key default gen_random_uuid(),
  brand_name           text not null,
  business_model       text,
  industry             text,
  total_score          integer,
  maturity_level       text,
  scores               jsonb,
  services_recommended text[],
  is_manual            boolean default false,
  assessor_name        text,
  rubric_version       text,
  created_by           uuid references auth.users(id),
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

alter table public.compass_results add column if not exists assessor_name  text;
alter table public.compass_results add column if not exists rubric_version text;

create index if not exists compass_results_industry_idx on public.compass_results (industry);
create index if not exists compass_results_created_idx  on public.compass_results (created_at desc);


-- ═══════════════════════════════════════════════════════════════
-- 3. SAVED_ASSESSMENTS — full in-progress and completed assessments
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.saved_assessments (
  id          uuid primary key default gen_random_uuid(),
  brand_name  text not null,
  project     jsonb not null,
  assessments jsonb not null,
  scores      jsonb,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- saveAssessment looks up an existing row by brand name with .single(), which
-- errors if two rows share a name. This index makes that guarantee real
-- rather than assumed. If it fails, you have duplicates: find them with the
-- query in SUPABASE_VERIFY.sql and delete the older ones first.
create unique index if not exists saved_assessments_brand_name_key
  on public.saved_assessments (brand_name);


-- ═══════════════════════════════════════════════════════════════
-- 4. CLIENT_REPORTS — password-gated client links
-- ═══════════════════════════════════════════════════════════════
--
-- Stores ONLY ciphertext. The payload is encrypted in the browser with a key
-- derived from the assessor's chosen password (PBKDF2 250k, AES-GCM 256). The
-- password never reaches Supabase and is not recoverable by anyone. A leaked
-- row is useless without it, which is why anonymous SELECT is safe here.

create table if not exists public.client_reports (
  token           text primary key,
  brand_name      text not null,
  cipher          text not null,
  salt            text not null,
  iv              text not null,
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now()
);

alter table public.client_reports add column if not exists created_by_name text;

create index if not exists client_reports_created_by_idx
  on public.client_reports (created_by, created_at desc);


-- ═══════════════════════════════════════════════════════════════
-- 5. WEEKLY CACHE TABLES — written by cron, read by everyone
-- ═══════════════════════════════════════════════════════════════
--
-- Single-row tables, always id = 1. The serverless refresh routes upsert with
-- the service role key, which bypasses RLS; authenticated users only read.

create table if not exists public.stay_conscious_cache (
  id           integer primary key default 1,
  items        jsonb not null,
  refreshed_at timestamptz not null
);

create table if not exists public.landscape_analysis_cache (
  id           integer primary key default 1,
  analysis     jsonb not null,
  refreshed_at timestamptz not null
);

create table if not exists public.insights_analysis_cache (
  id           integer primary key default 1,
  stories      jsonb not null,
  refreshed_at timestamptz not null
);

create table if not exists public.stay_conscious_newsletter (
  id           integer primary key default 1,
  newsletter   jsonb not null,
  refreshed_at timestamptz not null
);


-- ═══════════════════════════════════════════════════════════════
-- 6. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

alter table public.profiles                  enable row level security;
alter table public.compass_results           enable row level security;
alter table public.saved_assessments         enable row level security;
alter table public.client_reports            enable row level security;
alter table public.stay_conscious_cache      enable row level security;
alter table public.landscape_analysis_cache  enable row level security;
alter table public.insights_analysis_cache   enable row level security;
alter table public.stay_conscious_newsletter enable row level security;


-- ── Profiles ──────────────────────────────────────────────────

drop policy if exists "Users can view all profiles" on public.profiles;
create policy "Users can view all profiles"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Admin check reads is_admin from the SAME table this policy guards, which
-- recurses. A SECURITY DEFINER function breaks the cycle by reading the row
-- outside RLS. The original inline EXISTS subquery worked only because the
-- select policy above is unconditional; this is the version that stays
-- correct if that ever tightens.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = uid), false);
$$;

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
  on public.profiles for update to authenticated using (public.is_admin(auth.uid()));


-- ── Compass results and saved assessments ─────────────────────
-- Shared workspace: any approved user can read and write everything.

create or replace function public.is_approved(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select p.is_approved from public.profiles p where p.id = uid), false);
$$;

do $$
declare
  t text;
  op text;
begin
  foreach t in array array['compass_results', 'saved_assessments'] loop
    foreach op in array array['select', 'insert', 'update', 'delete'] loop
      execute format('drop policy if exists %I on public.%I', t || '_' || op, t);
      if op = 'insert' then
        execute format(
          'create policy %I on public.%I for insert to authenticated with check (public.is_approved(auth.uid()))',
          t || '_' || op, t);
      else
        execute format(
          'create policy %I on public.%I for %s to authenticated using (public.is_approved(auth.uid()))',
          t || '_' || op, t, op);
      end if;
    end loop;
  end loop;
end $$;

-- Retire the older policy names so the two sets cannot both be live. Postgres
-- ORs permissive policies together, so a stale one would keep granting access.
drop policy if exists "Approved users can view all results"     on public.compass_results;
drop policy if exists "Approved users can insert results"       on public.compass_results;
drop policy if exists "Approved users can update results"       on public.compass_results;
drop policy if exists "Approved users can delete results"       on public.compass_results;
drop policy if exists "Approved users can view all assessments" on public.saved_assessments;
drop policy if exists "Approved users can insert assessments"   on public.saved_assessments;
drop policy if exists "Approved users can update assessments"   on public.saved_assessments;
drop policy if exists "Approved users can delete assessments"   on public.saved_assessments;


-- ── Client reports ────────────────────────────────────────────

drop policy if exists "client_reports_anon_read" on public.client_reports;
create policy "client_reports_anon_read"
  on public.client_reports for select to anon, authenticated using (true);

drop policy if exists "client_reports_insert" on public.client_reports;
create policy "client_reports_insert"
  on public.client_reports for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "client_reports_update" on public.client_reports;
create policy "client_reports_update"
  on public.client_reports for update to authenticated
  using       (auth.uid() = created_by or public.is_admin(auth.uid()))
  with check  (auth.uid() = created_by or public.is_admin(auth.uid()));

drop policy if exists "client_reports_delete" on public.client_reports;
create policy "client_reports_delete"
  on public.client_reports for delete to authenticated
  using (auth.uid() = created_by or public.is_admin(auth.uid()));


-- ── Cache tables: read-only to users, written by the service role ──

do $$
declare t text;
begin
  foreach t in array array[
    'stay_conscious_cache', 'landscape_analysis_cache',
    'insights_analysis_cache', 'stay_conscious_newsletter'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_read', t);
  end loop;
end $$;

drop policy if exists "Authenticated users can read stay conscious cache"     on public.stay_conscious_cache;
drop policy if exists "Authenticated users can read landscape analysis cache" on public.landscape_analysis_cache;
drop policy if exists "Authenticated users can read insights analysis cache"  on public.insights_analysis_cache;
drop policy if exists "Authenticated users can read newsletter cache"         on public.stay_conscious_newsletter;


-- ═══════════════════════════════════════════════════════════════
-- 7. SIGNUP TRIGGER — creates a profile row on registration
-- ═══════════════════════════════════════════════════════════════
--
-- New users land unapproved and non-admin. An admin approves them in the
-- Admin panel. ON CONFLICT keeps a re-run from failing on existing users.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, is_admin, is_approved)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    false,
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ═══════════════════════════════════════════════════════════════
-- 8. BACKFILL — profiles for any users who signed up before the trigger
-- ═══════════════════════════════════════════════════════════════

insert into public.profiles (id, email, full_name, is_admin, is_approved)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', ''), false, false
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;


-- ═══════════════════════════════════════════════════════════════
-- 9. FINAL STEP — make yourself an admin
-- ═══════════════════════════════════════════════════════════════
--
-- Sign up in the app first, then uncomment and run with your own address.
-- Until at least one admin exists, nobody can approve anybody.

-- update public.profiles
--    set is_admin = true, is_approved = true
--  where email = 'you@antennagroup.com';
