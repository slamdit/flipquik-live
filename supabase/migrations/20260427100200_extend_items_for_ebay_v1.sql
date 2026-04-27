-- Phase 1B: Extend items with the fields eBay v1 publish will need. All
-- nullable, all additive. Does not touch the existing status check
-- constraint (see 20260417100000_fix_status_constraint_v2.sql).

alter table public.items
  add column if not exists sku                 text,
  add column if not exists quantity            integer default 1,
  add column if not exists category_id         text,
  add column if not exists weight_oz           numeric,
  add column if not exists package_length_in   numeric,
  add column if not exists package_width_in    numeric,
  add column if not exists package_height_in   numeric,
  add column if not exists ebay_condition_id   text,
  add column if not exists ebay_marketplace_id text default 'EBAY_US';

-- Per-user uniqueness for SKU when present. Partial index keeps NULLs free.
create unique index if not exists items_user_sku_unique
  on public.items (user_id, sku) where sku is not null;
