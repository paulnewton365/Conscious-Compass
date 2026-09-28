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

-- ── Campaigns (v3.30) ──
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.teaser_campaigns (id, name, created_by) values
  ('00000000-0000-0000-0000-0000000000c1', 'Climate Week', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c2', 'Q4 Energy',    '00000000-0000-0000-0000-00000000000a');
insert into public.teaser_assessments (brand_name, website_url, campaign_id, result)
  values ('Acme', 'https://acme.com', '00000000-0000-0000-0000-0000000000c1', '{"overall":49}');
insert into outcome select 'admin can create and read campaigns', (select count(*) from public.teaser_campaigns) = 2;

do $$ begin
  begin
    insert into public.teaser_campaigns (name) values ('  climate WEEK ');
    insert into outcome values ('duplicate name (case and spaces) refused', false);
  exception when unique_violation then
    insert into outcome values ('duplicate name (case and spaces) refused', true);
  end;
  begin
    insert into public.teaser_campaigns (name) values ('   ');
    insert into outcome values ('blank campaign name refused', false);
  exception when check_violation then
    insert into outcome values ('blank campaign name refused', true);
  end;
  begin
    delete from public.teaser_campaigns where id = '00000000-0000-0000-0000-0000000000c1';
    insert into outcome values ('campaign with teasers cannot be deleted', false);
  exception when foreign_key_violation then
    insert into outcome values ('campaign with teasers cannot be deleted', true);
  end;
end $$;

update public.teaser_campaigns set name = 'Climate Week 2026' where id = '00000000-0000-0000-0000-0000000000c1';
insert into outcome select 'rename carries its teasers',
  (select c.name from public.teaser_assessments t join public.teaser_campaigns c on c.id = t.campaign_id where t.brand_name = 'Acme') = 'Climate Week 2026';

with d as (delete from public.teaser_campaigns where id = '00000000-0000-0000-0000-0000000000c2' returning 1)
  insert into outcome select 'empty campaign can be deleted', (select count(*) from d) = 1;

update public.teaser_assessments set campaign_id = null where brand_name = 'Acme';
with d as (delete from public.teaser_campaigns where id = '00000000-0000-0000-0000-0000000000c1' returning 1)
  insert into outcome select 'campaign deletable once emptied', (select count(*) from d) = 1;
insert into outcome select 'emptied teaser survives its campaign', (select count(*) from public.teaser_assessments where brand_name = 'Acme') = 1;

insert into public.teaser_campaigns (id, name) values ('00000000-0000-0000-0000-0000000000c3', 'Staff probe');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into outcome select 'non-admin sees no campaigns', (select count(*) from public.teaser_campaigns) = 0;
with u as (update public.teaser_campaigns set name = 'x' returning 1) insert into outcome select 'non-admin cannot rename campaigns', (select count(*) from u) = 0;
with d as (delete from public.teaser_campaigns returning 1) insert into outcome select 'non-admin cannot delete campaigns', (select count(*) from d) = 0;
do $$ begin
  begin
    insert into public.teaser_campaigns (name) values ('Sneaky');
    insert into outcome values ('non-admin cannot create campaigns', false);
  exception when insufficient_privilege then
    insert into outcome values ('non-admin cannot create campaigns', true);
  end;
end $$;
reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false);
insert into outcome select 'anonymous sees no campaigns', (select count(*) from public.teaser_campaigns) = 0;
reset role;
insert into outcome select 'campaigns left full results untouched',
  (select count(*) from public.compass_results) = 1 and (select count(*) from public.saved_assessments) = 1
  and (select total_score from public.compass_results where brand_name = 'FullBrand') = 61;

-- ── CSO audience flag (v3.36) ──
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.teaser_campaigns (id, name) values ('00000000-0000-0000-0000-0000000000c9', 'Audience default');
insert into outcome select 'new campaigns default to general audience',
  (select cso_audience from public.teaser_campaigns where id = '00000000-0000-0000-0000-0000000000c9') = false;
update public.teaser_campaigns set cso_audience = true where id = '00000000-0000-0000-0000-0000000000c9';
insert into outcome select 'admin can switch a campaign to CSO',
  (select cso_audience from public.teaser_campaigns where id = '00000000-0000-0000-0000-0000000000c9') = true;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
with u as (update public.teaser_campaigns set cso_audience = false returning 1)
  insert into outcome select 'non-admin cannot change audience', (select count(*) from u) = 0;
reset role;

-- ── Business users (v3.50): teaser access, no admin rights ──
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'biz@antenna.test') on conflict do nothing;
-- Granting a role is an admin action, so act as the admin. The role-guard
-- trigger blocks anyone else from setting these columns.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.profiles set is_admin = false, is_biz = true, is_approved = true, is_readonly = false
  where id = '00000000-0000-0000-0000-00000000000c';
insert into outcome select 'admin can grant the business role',
  (select is_biz from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = true;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
insert into public.teaser_campaigns (id, name) values ('00000000-0000-0000-0000-0000000000d1', 'Biz campaign');
insert into public.teaser_assessments (brand_name, website_url, campaign_id, result)
  values ('BizBrand', 'https://biz.test', '00000000-0000-0000-0000-0000000000d1', '{"overall":57}');
insert into outcome select 'business user can create a campaign and a teaser',
  (select count(*) from public.teaser_campaigns where id = '00000000-0000-0000-0000-0000000000d1') = 1
  and (select count(*) from public.teaser_assessments where brand_name = 'BizBrand') = 1;
insert into outcome select 'business user can read teasers', (select count(*) from public.teaser_assessments) >= 1;
with u as (update public.teaser_assessments set business_model = 'b2c' where brand_name = 'BizBrand' returning 1)
  insert into outcome select 'business user can update a teaser', (select count(*) from u) = 1;
insert into outcome select 'business user can read full results for the baseline', (select count(*) from public.compass_results) >= 1;

-- ...but no admin rights.
update public.profiles set is_admin = true, is_readonly = false where id = '00000000-0000-0000-0000-00000000000c';
insert into outcome select 'business user cannot make themselves admin',
  (select is_admin from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = false;
insert into outcome select 'business user is not an admin', public.is_admin('00000000-0000-0000-0000-00000000000c') = false;
insert into outcome select 'business user may use the teaser', public.can_teaser('00000000-0000-0000-0000-00000000000c') = true;

-- A plain full user still cannot reach the teaser.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into outcome select 'full user still sees no teasers', (select count(*) from public.teaser_assessments) = 0;
insert into outcome select 'full user still sees no campaigns', (select count(*) from public.teaser_campaigns) = 0;
insert into outcome select 'full user may not use the teaser', public.can_teaser('00000000-0000-0000-0000-00000000000b') = false;
reset role;

-- Read-only and unapproved business users are shut out too.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.profiles set is_readonly = true where id = '00000000-0000-0000-0000-00000000000c';
insert into outcome select 'read-only business user may not use the teaser', public.can_teaser('00000000-0000-0000-0000-00000000000c') = false;
update public.profiles set is_readonly = false, is_approved = false where id = '00000000-0000-0000-0000-00000000000c';
insert into outcome select 'unapproved business user may not use the teaser', public.can_teaser('00000000-0000-0000-0000-00000000000c') = false;
update public.profiles set is_approved = true where id = '00000000-0000-0000-0000-00000000000c';

-- Admins keep full teaser access.
insert into outcome select 'admin may still use the teaser', public.can_teaser('00000000-0000-0000-0000-00000000000a') = true;

-- Cleanup so later checks see the same counts.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
delete from public.teaser_assessments where brand_name = 'BizBrand';
delete from public.teaser_campaigns where id = '00000000-0000-0000-0000-0000000000d1';
reset role;

select (case when pass then 'PASS' else 'FAIL' end) || '  ' || check_name as result from outcome;
