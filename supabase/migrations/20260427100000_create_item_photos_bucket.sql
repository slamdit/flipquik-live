-- Phase 1A: Photo Storage — codify the item-photos bucket and lock down RLS.
-- The bucket already exists in production (created manually); this migration is
-- idempotent so it is safe to run anywhere.

-- Idempotent bucket creation (private)
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', false)
on conflict (id) do nothing;

-- Path convention used by src/lib/supabase.js and PhotoCapture.jsx:
--   {userId}/{timestamp}-{random}.{ext}
-- so split_part(name, '/', 1) is the owning user id.

drop policy if exists "item-photos owner read"   on storage.objects;
drop policy if exists "item-photos owner insert" on storage.objects;
drop policy if exists "item-photos owner update" on storage.objects;
drop policy if exists "item-photos owner delete" on storage.objects;

create policy "item-photos owner read"
  on storage.objects for select
  using (bucket_id = 'item-photos' and split_part(name, '/', 1) = auth.uid()::text);

create policy "item-photos owner insert"
  on storage.objects for insert
  with check (bucket_id = 'item-photos' and split_part(name, '/', 1) = auth.uid()::text);

create policy "item-photos owner update"
  on storage.objects for update
  using (bucket_id = 'item-photos' and split_part(name, '/', 1) = auth.uid()::text);

create policy "item-photos owner delete"
  on storage.objects for delete
  using (bucket_id = 'item-photos' and split_part(name, '/', 1) = auth.uid()::text);
