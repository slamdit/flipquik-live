-- Adds Comeback Plan honor-system fields to the profiles table.
-- comeback_plan_active: set true at signup if user is claiming via /comeback.
-- comeback_plan_started_at: timestamp from which the 90-day Pro grant runs.
-- Both default false / null so existing rows are unaffected.

alter table public.profiles
  add column if not exists comeback_plan_active     boolean      not null default false,
  add column if not exists comeback_plan_started_at timestamptz;

-- SQL helper so backend code (edge functions, RLS, future reports) shares one
-- definition of "is this user currently in their 90-day Comeback window?"
-- Mirrors the JS helper isProActive() in src/lib/proStatus.js — keep in sync.
create or replace function public.is_comeback_active(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.comeback_plan_active
        and p.comeback_plan_started_at is not null
        and p.comeback_plan_started_at > now() - interval '90 days'
      from public.profiles p
      where p.id = p_profile_id
    ),
    false
  );
$$;

-- Partial index for future cohort queries (day-30 invitation, day-85 reminder)
-- so we don't full-scan profiles.
create index if not exists idx_profiles_comeback_active
  on public.profiles (comeback_plan_started_at)
  where comeback_plan_active = true;

-- Self-update RLS policy on profiles. Not used by the Comeback signup flow
-- (the trigger below handles that path), but kept here so future profile
-- self-edits work without another migration.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'profiles'
      and policyname = 'Users can update their own profile'
  ) then
    create policy "Users can update their own profile"
      on public.profiles for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

-- Extend handle_new_user to honor claiming_comeback from auth metadata.
-- The Login.jsx signup form passes claiming_comeback: true via signUp's
-- options.data when the checkbox is on. The trigger runs SECURITY DEFINER
-- at row creation, which sidesteps the unauth'd-update-during-email-
-- confirmation problem a client-side .update() would hit.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  claiming boolean;
begin
  claiming := coalesce((new.raw_user_meta_data->>'claiming_comeback')::boolean, false);

  insert into public.profiles (
    id, full_name, email, is_pro, subscription_status,
    comeback_plan_active, comeback_plan_started_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    false,
    'free',
    claiming,
    case when claiming then now() else null end
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
