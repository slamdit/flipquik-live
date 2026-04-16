-- Add plan_tier column to profiles for Free / Pro / Max tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'free';

-- Add check constraint (safe: drops if already exists)
DO $$
BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_plan_tier_check
    CHECK (plan_tier IN ('free', 'pro', 'max'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
