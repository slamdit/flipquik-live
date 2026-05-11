-- Migration: create `leads` table for landing-page email captures
-- Date: 2026-05-11
-- Context: powers the Playbook lead-magnet form on flipquik.com landing page.
-- ESP integration (Klaviyo/Mailchimp/ConvertKit) reads from this table on a
-- schedule or via webhook to send the welcome sequence.

create table if not exists public.leads (
  id           uuid          primary key default gen_random_uuid(),
  email        text          not null,
  source       text          not null default 'landing-page',
  created_at   timestamptz   not null default now()
);

-- Case-insensitive uniqueness on email. We also lowercase client-side before
-- insert, so this is belt-and-suspenders.
create unique index if not exists leads_email_lower_unique
  on public.leads ((lower(email)));

-- Index for chronological pulls (ESP polling by created_at desc).
create index if not exists leads_created_at_idx
  on public.leads (created_at desc);

-- RLS: enabled, with anon allowed to INSERT only.
-- Anon cannot SELECT (no policy granted) — prevents scraping the list.
-- Authenticated users can INSERT (handles the edge case of a logged-in user
-- submitting the form). Service role bypasses RLS by default for admin export.
alter table public.leads enable row level security;

drop policy if exists "anon can insert leads" on public.leads;
create policy "anon can insert leads"
  on public.leads
  for insert
  to anon
  with check (true);

drop policy if exists "authenticated can insert leads" on public.leads;
create policy "authenticated can insert leads"
  on public.leads
  for insert
  to authenticated
  with check (true);

-- Intentionally NO select policy for anon or authenticated.
-- To read leads for admin export, use the service_role key from a server
-- environment (e.g. a scheduled edge function or a one-off SQL query in the
-- Supabase dashboard).
