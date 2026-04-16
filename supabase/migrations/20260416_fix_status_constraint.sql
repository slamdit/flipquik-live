-- BUG 1: Fix items_status_check constraint to allow all four valid statuses
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check;
ALTER TABLE items ADD CONSTRAINT items_status_check
  CHECK (status IN ('draft', 'clipped', 'listed', 'flipped'));
