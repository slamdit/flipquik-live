-- QuikEval usage log — one row per successful call, used to enforce a
-- rolling 24-hour rate limit (default 30 calls / 24h) in the edge function.

create table if not exists public.quikeval_usage (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists quikeval_usage_user_created_at_idx
  on public.quikeval_usage (user_id, created_at desc);

alter table public.quikeval_usage enable row level security;

-- Users may read their own usage rows (so the UI can show "X of 30 used").
-- Inserts/deletes happen only via the edge function using the service role,
-- which bypasses RLS — so no insert/delete policy is needed.
drop policy if exists "users read own quikeval_usage" on public.quikeval_usage;
create policy "users read own quikeval_usage"
  on public.quikeval_usage
  for select
  using (auth.uid() = user_id);
