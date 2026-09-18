\set ON_ERROR_STOP 1
-- Three users: an admin, an approved non-admin, and anonymous.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@antenna.test'),
  ('00000000-0000-0000-0000-00000000000b', 'staff@antenna.test')
on conflict do nothing;
update public.profiles set is_admin = true,  is_approved = true where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set is_admin = false, is_approved = true where id = '00000000-0000-0000-0000-00000000000b';

-- A pre-existing full result, so we can see teasers do not touch it.
insert into public.compass_results (brand_name, total_score, scores) values ('FullBrand', 61, '{"AWAKE":{"score":61}}');
insert into public.saved_assessments (brand_name, project, assessments) values ('FullBrand', '{}', '{}');

create temp table outcome (check_name text, pass boolean);
grant all on outcome to authenticated, anon;

-- ── As the admin ──
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.teaser_assessments (brand_name, website_url, result, created_by)
  values ('Acme', 'https://acme.com', '{"overall":49}', '00000000-0000-0000-0000-00000000000a');
insert into outcome select 'admin can read teasers', (select count(*) from public.teaser_assessments) = 1;
insert into outcome select 'teaser did not add a compass_results row', (select count(*) from public.compass_results) = 1;
insert into outcome select 'teaser did not add a saved_assessments row', (select count(*) from public.saved_assessments) = 1;
insert into outcome select 'teaser brand absent from compass_results', not exists (select 1 from public.compass_results where brand_name = 'Acme');
insert into outcome select 'teaser brand absent from saved_assessments', not exists (select 1 from public.saved_assessments where brand_name = 'Acme');
insert into outcome select 'full result unchanged', (select total_score from public.compass_results where brand_name = 'FullBrand') = 61;

-- ── As an approved non-admin ──
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into outcome select 'non-admin sees no teasers', (select count(*) from public.teaser_assessments) = 0;
with u as (update public.teaser_assessments set brand_name = 'x' returning 1) insert into outcome select 'non-admin cannot update teasers', (select count(*) from u) = 0;
with d as (delete from public.teaser_assessments returning 1) insert into outcome select 'non-admin cannot delete teasers', (select count(*) from d) = 0;
insert into outcome select 'non-admin still sees full results', (select count(*) from public.compass_results) = 1;
do $$ begin
  begin
    insert into public.teaser_assessments (brand_name, website_url) values ('Sneak', 'https://s.com');
    insert into outcome values ('non-admin cannot insert teasers', false);
  exception when insufficient_privilege then
    insert into outcome values ('non-admin cannot insert teasers', true);
  end;
end $$;

-- ── Anonymous ──
reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false);
insert into outcome select 'anonymous sees no teasers', (select count(*) from public.teaser_assessments) = 0;

-- ── Back as admin: the row survived every attempt ──
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into outcome select 'teaser row intact after non-admin attempts', (select brand_name from public.teaser_assessments) = 'Acme';
with d as (delete from public.teaser_assessments returning 1) insert into outcome select 'admin can delete teasers', (select count(*) from d) = 1;
insert into outcome select 'deleting a teaser leaves full results alone', (select count(*) from public.compass_results) = 1 and (select count(*) from public.saved_assessments) = 1;
reset role;

select (case when pass then 'PASS' else 'FAIL' end) || '  ' || check_name as result from outcome;
