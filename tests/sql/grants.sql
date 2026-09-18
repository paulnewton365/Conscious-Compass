-- Supabase grants table privileges to these roles by default; RLS is what
-- actually restricts them. Mirror that so the test exercises RLS, not grants.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
