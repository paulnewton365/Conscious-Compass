-- ─────────────────────────────────────────────────────────────
-- Conscious Compass — verify the database is set up correctly
--
-- Run AFTER SUPABASE_SETUP.sql. Reads only; changes nothing.
-- Every row should say PASS. Anything else tells you what is missing.
-- ─────────────────────────────────────────────────────────────

with
required_tables (t) as (values
  ('profiles'), ('compass_results'), ('saved_assessments'), ('client_reports'),
  ('stay_conscious_cache'), ('landscape_analysis_cache'),
  ('insights_analysis_cache'), ('stay_conscious_newsletter')
),
required_columns (t, c) as (values
  ('profiles','is_readonly'), ('profiles','last_login'), ('profiles','full_name'),
  ('profiles','is_admin'), ('profiles','is_approved'),
  ('compass_results','assessor_name'), ('compass_results','rubric_version'),
  ('compass_results','scores'), ('compass_results','services_recommended'),
  ('saved_assessments','project'), ('saved_assessments','assessments'), ('saved_assessments','scores'),
  ('client_reports','cipher'), ('client_reports','salt'), ('client_reports','iv'),
  ('client_reports','created_by_name'),
  ('stay_conscious_cache','items'),
  ('landscape_analysis_cache','analysis'),
  ('insights_analysis_cache','stories'),
  ('stay_conscious_newsletter','newsletter')
)

-- 1. Tables exist
select
  '1. table' as check_type,
  rt.t       as object,
  case when to_regclass('public.' || rt.t) is not null
       then 'PASS' else 'MISSING — re-run SUPABASE_SETUP.sql' end as result
from required_tables rt

union all

-- 2. Columns exist
select
  '2. column',
  rc.t || '.' || rc.c,
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = rc.t and column_name = rc.c
  ) then 'PASS' else 'MISSING — re-run SUPABASE_SETUP.sql' end
from required_columns rc

union all

-- 3. RLS enabled on every table
select
  '3. rls',
  rt.t,
  case when coalesce((
    select c.relrowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = rt.t
  ), false) then 'PASS' else 'RLS OFF — data is publicly readable' end
from required_tables rt

union all

-- 4. Each table has at least one policy
select
  '4. policies',
  rt.t,
  case when (select count(*) from pg_policies p
             where p.schemaname = 'public' and p.tablename = rt.t) > 0
       then 'PASS (' || (select count(*) from pg_policies p
                         where p.schemaname = 'public' and p.tablename = rt.t) || ')'
       else 'NO POLICIES — RLS on with no policy blocks all access' end
from required_tables rt

union all

-- 5. Signup trigger present
select
  '5. trigger', 'on_auth_user_created',
  case when exists (
    select 1 from pg_trigger where tgname = 'on_auth_user_created' and not tgisinternal
  ) then 'PASS' else 'MISSING — new signups will not get a profile' end

union all

-- 6. Profile delete cascades from auth.users
select
  '6. cascade', 'profiles_id_fkey',
  case when exists (
    select 1 from information_schema.referential_constraints
    where constraint_name = 'profiles_id_fkey' and delete_rule = 'CASCADE'
  ) then 'PASS' else 'NOT CASCADING — admin user deletion will fail' end

union all

-- 7. At least one admin exists, or nobody can approve anybody
select
  '7. admin', 'admin account',
  case when exists (select 1 from public.profiles where is_admin = true)
       then 'PASS (' || (select count(*) from public.profiles where is_admin) || ')'
       else 'NONE — run the UPDATE at the end of SUPABASE_SETUP.sql' end

union all

-- 8. Every auth user has a profile row
select
  '8. profiles', 'orphaned auth users',
  case when (select count(*) from auth.users u
             left join public.profiles p on p.id = u.id where p.id is null) = 0
       then 'PASS'
       else (select count(*)::text from auth.users u
             left join public.profiles p on p.id = u.id where p.id is null)
            || ' user(s) without a profile — re-run section 8 of setup' end

union all

-- 9. Duplicate brand names would break saveAssessment's .single() lookup
select
  '9. integrity', 'saved_assessments brand_name',
  case when (select count(*) from (
         select brand_name from public.saved_assessments
         group by brand_name having count(*) > 1) d) = 0
       then 'PASS'
       else 'DUPLICATES — saving will fail for those brands, see query below' end

order by 1, 2;


-- ── If check 9 fails, list the offenders ──────────────────────
-- select brand_name, count(*), min(created_at) as oldest, max(created_at) as newest
--   from public.saved_assessments
--  group by brand_name having count(*) > 1;

-- ── Confirm the cron cache tables are actually being populated ──
-- A NULL refreshed_at means the weekly job has not run yet or is failing.
-- select 'stay_conscious'    as cache, refreshed_at from public.stay_conscious_cache      where id = 1
-- union all
-- select 'landscape',              refreshed_at from public.landscape_analysis_cache  where id = 1
-- union all
-- select 'insights',               refreshed_at from public.insights_analysis_cache   where id = 1
-- union all
-- select 'newsletter',             refreshed_at from public.stay_conscious_newsletter where id = 1;
