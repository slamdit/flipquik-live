// Global setup: login once and save auth state for all tests
// Set FLIPQUIK_EMAIL and FLIPQUIK_PASSWORD env vars, or they default to the values below
import { test as setup, expect } from '@playwright/test';

const EMAIL    = process.env.FLIPQUIK_EMAIL    || 'slamd694@gmail.com';
const PASSWORD = process.env.FLIPQUIK_PASSWORD || ']h$!a8A$i&;YPae';

setup('authenticate', async ({ page }) => {
  setup.setTimeout(60000);

  await page.goto('https://flipquik.com/login', { waitUntil: 'networkidle' });

  // Fill and submit login form
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();

  // Wait for either dashboard or error
  const dashboard = page.locator('h1').filter({ hasText: 'FlipQuik' });
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]');

  await expect(dashboard.or(errorToast)).toBeVisible({ timeout: 20000 });

  // If error toast appeared, fail with a useful message
  if (await errorToast.isVisible().catch(() => false)) {
    const errText = await errorToast.innerText();
    throw new Error(`Login failed: ${errText}. Check FLIPQUIK_EMAIL / FLIPQUIK_PASSWORD env vars.`);
  }

  // Confirm we're on the dashboard
  await expect(dashboard).toBeVisible();

  // Save auth state (cookies + localStorage with Supabase token)
  await page.context().storageState({ path: 'tests/.auth/state.json' });
});
