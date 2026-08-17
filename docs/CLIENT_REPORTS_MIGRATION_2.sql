-- ─────────────────────────────────────────────────────────────
-- Client report links, addendum for the management panel (v2.25.0)
--
-- Run this AFTER CLIENT_REPORTS_MIGRATION.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- Who issued the link. Stored at insert rather than joined from profiles at
-- read time, which would need a policy allowing users to read each other's
-- profile rows.
alter table public.client_reports
  add column if not exists created_by_name text;

-- Password reset re-encrypts the payload in place and keeps the same token,
-- so a link already sent to a client keeps working.
drop policy if exists "client_reports_update" on public.client_reports;
create policy "client_reports_update"
  on public.client_reports for update
  to authenticated
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    auth.uid() = created_by
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
