-- Phase 1A: Extend the existing item_photos table with the columns needed for
-- the eBay auto-listing pipeline. Additive only — preserves the legacy
-- (original_photo, is_cover) columns that FlipIt.jsx and EditItemModal.jsx
-- still read.

alter table public.item_photos
  add column if not exists user_id        uuid references auth.users(id),
  add column if not exists storage_path   text,
  add column if not exists public_url     text,
  add column if not exists photo_type     text default 'listing',
  add column if not exists is_primary     boolean default false,
  add column if not exists source         text default 'upload',
  add column if not exists updated_at     timestamptz default now(),
  -- Legacy-compat columns. Some environments already have these; on
  -- environments that don't, we add them so FlipIt's existing insert
  -- payload (original_photo, is_cover) continues to round-trip cleanly
  -- and EditItemModal's read path keeps working.
  add column if not exists original_photo text,
  add column if not exists is_cover       boolean default false;

-- Backfill: legacy rows kept the URL in original_photo. Mirror it forward.
-- Wrapped in DO so the migration is safe whether or not the legacy column
-- exists on this database.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'item_photos'
       and column_name  = 'original_photo'
  ) then
    execute $sql$
      update public.item_photos
         set public_url = original_photo
       where public_url is null and original_photo is not null
    $sql$;
  end if;
end $$;

-- Backfill: mirror is_cover into is_primary so the new code path can rely on
-- is_primary alone going forward. Same defensive guard as above.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'item_photos'
       and column_name  = 'is_cover'
  ) then
    execute $sql$
      update public.item_photos
         set is_primary = coalesce(is_primary, false) or coalesce(is_cover, false)
    $sql$;
  end if;
end $$;

-- Backfill user_id from the parent item (single-tenant per item).
update public.item_photos p
   set user_id = i.user_id
  from public.items i
 where p.item_id = i.id and p.user_id is null;

create index if not exists item_photos_item_id_sort_order_idx
  on public.item_photos (item_id, sort_order);

-- Tighten RLS so users can only see their own photo rows.
alter table public.item_photos enable row level security;

drop policy if exists "item_photos owner select" on public.item_photos;
drop policy if exists "item_photos owner insert" on public.item_photos;
drop policy if exists "item_photos owner update" on public.item_photos;
drop policy if exists "item_photos owner delete" on public.item_photos;

create policy "item_photos owner select"
  on public.item_photos for select using (user_id = auth.uid());

create policy "item_photos owner insert"
  on public.item_photos for insert with check (user_id = auth.uid());

create policy "item_photos owner update"
  on public.item_photos for update using (user_id = auth.uid());

create policy "item_photos owner delete"
  on public.item_photos for delete using (user_id = auth.uid());
