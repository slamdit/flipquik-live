-- Widen items_status_check to include sold and archived (used by legacy code paths)
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check;
ALTER TABLE items ADD CONSTRAINT items_status_check
  CHECK (status IN ('draft', 'clipped', 'listed', 'flipped', 'sold', 'archived'));
