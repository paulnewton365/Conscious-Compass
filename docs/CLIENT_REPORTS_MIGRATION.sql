-- ─────────────────────────────────────────────────────────────
-- Client report links (gated, cleansed report shared with clients)
--
-- Run once in the Supabase SQL editor.
--
-- The row stores ONLY ciphertext. The report payload is encrypted in the
-- browser with a key derived from the password the assessor chooses
-- (PBKDF2 250k iterations, AES-GCM 256). The password is never sent to
-- Supabase and is not recoverable by anyone, including us. A leaked row is
-- useless without the password, which is why anonymous SELECT is safe here.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.client_reports (
  token       text primary key,
  brand_name  text not null,
  cipher      text not null,
  salt        text not null,
  iv          text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.client_reports enable row level security;

-- Anyone with the link can read the ciphertext. Without the password it
-- decrypts to nothing.
drop policy if exists "client_reports_anon_read" on public.client_reports;
create policy "client_reports_anon_read"
  on public.client_reports for select
  to anon, authenticated
  using (true);

-- Only signed-in users can create links.
drop policy if exists "client_reports_insert" on public.client_reports;
create policy "client_reports_insert"
  on public.client_reports for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Creators can revoke their own links; admins can revoke any.
drop policy if exists "client_reports_delete" on public.client_reports;
create policy "client_reports_delete"
  on public.client_reports for delete
  to authenticated
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create index if not exists client_reports_created_by_idx
  on public.client_reports (created_by, created_at desc);
