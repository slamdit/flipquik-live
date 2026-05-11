// Single source of truth: is the given profile entitled to Pro features right now?
// Returns true if either:
//   - subscription_status / plan_tier / is_pro indicates a paid Stripe Pro or Max
//     subscription, OR
//   - comeback_plan_active is true AND comeback_plan_started_at is within 90 days
//
// Keep this in sync with the SQL helper public.is_comeback_active() in
// migration 20260511190000_add_comeback_plan_fields.sql.

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function isProActive(profile) {
  if (!profile) return false;

  const paid =
    profile.is_pro ||
    profile.plan_tier === 'pro' || profile.plan_tier === 'max' ||
    profile.subscription_status === 'pro' || profile.subscription_status === 'max';
  if (paid) return true;

  if (profile.comeback_plan_active && profile.comeback_plan_started_at) {
    const startedAt = new Date(profile.comeback_plan_started_at).getTime();
    if (!Number.isNaN(startedAt) && Date.now() - startedAt < NINETY_DAYS_MS) {
      return true;
    }
  }
  return false;
}

// Days remaining in the 90-day Comeback window, or null if not active.
// Useful for in-app banners ("X days left of your Comeback Pro access").
export function comebackDaysRemaining(profile) {
  if (!profile?.comeback_plan_active || !profile.comeback_plan_started_at) return null;
  const startedAt = new Date(profile.comeback_plan_started_at).getTime();
  if (Number.isNaN(startedAt)) return null;
  const remainingMs = NINETY_DAYS_MS - (Date.now() - startedAt);
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}
