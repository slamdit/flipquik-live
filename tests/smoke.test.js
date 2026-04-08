// FlipQuik Smoke Test Suite — Playwright
// Tests against the live site at https://flipquik.com
// Auth state is provided by auth.setup.js via storageState in playwright.config.js

import { test, expect } from '@playwright/test';

const EMAIL    = process.env.FLIPQUIK_EMAIL    || 'slamd694@gmail.com';
const PASSWORD = process.env.FLIPQUIK_PASSWORD || 'qwjDmV1siYYY7M';
const BASE     = 'https://flipquik.com';

// All navigable pages (after login)
const ALL_PAGES = [
  '/Dashboard', '/QuikEval', '/MultiEval', '/flip-it',
  '/Inventory', '/Sales', '/Performance',
];

// Helper: login fresh (only for auth-flow tests that need their own session)
async function loginFresh(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  // Wait for Dashboard content to appear (SPA client-side redirect)
  await expect(page.locator('h1').filter({ hasText: 'FlipQuik' })).toBeVisible({ timeout: 30000 });
}


// ═══════════════════════════════════════════════════════════════════
//  AUTH TESTS
// ═══════════════════════════════════════════════════════════════════
test.describe('AUTH', () => {
  test('1 — Login with valid credentials redirects to home', async ({ page }) => {
    await loginFresh(page);
    await expect(page).toHaveURL(/Dashboard/i);
  });

  test('2 — Logout redirects to login page', async ({ page }) => {
    await loginFresh(page);
    // Clear Supabase auth token from localStorage to simulate logout
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      if (key) localStorage.removeItem(key);
    });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/login/i);
  });

  test('3 — /inventory without auth redirects to login', async ({ page }) => {
    await page.goto(`${BASE}/Inventory`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/login/i);
  });

  test('4 — /quikeval without auth redirects to login', async ({ page }) => {
    await page.goto(`${BASE}/QuikEval`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/login/i);
  });

  test('5 — /flip-it without auth redirects to login', async ({ page }) => {
    await page.goto(`${BASE}/flip-it`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/login/i);
  });
});


// ═══════════════════════════════════════════════════════════════════
//  NAV TESTS  (logged in via storageState)
// ═══════════════════════════════════════════════════════════════════
test.describe('NAV', () => {
  test('6 — Nav links exist: Home, QuikEval, MultiEval, Flip It, Inventory, Sales, Performance', async ({ page }) => {
    await page.goto(`${BASE}/Dashboard`, { waitUntil: 'networkidle' });
    const nav = page.locator('nav');
    for (const label of ['Home', 'QuikEval', 'MultiEval', 'Flip It', 'Inventory', 'Sales', 'Performance']) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('7 — No "Base44" text on any page', async ({ page }) => {
    for (const route of ALL_PAGES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      const body = await page.locator('body').innerText();
      expect(body.toLowerCase()).not.toContain('base44');
    }
  });

  test('8 — Browser tab title says "FlipQuik" on every page', async ({ page }) => {
    for (const route of ALL_PAGES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      const title = await page.title();
      expect(title).toContain('FlipQuik');
    }
  });
});


// ═══════════════════════════════════════════════════════════════════
//  HOME PAGE TESTS
// ═══════════════════════════════════════════════════════════════════
test.describe('HOME PAGE', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/Dashboard`, { waitUntil: 'networkidle' });
  });

  test('9 — "FlipQuik" heading appears', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: 'FlipQuik' })).toBeVisible();
  });

  test('10 — QuikEval button exists', async ({ page }) => {
    await expect(page.locator('a[href="/QuikEval"]').filter({ hasText: 'QuikEval' })).toBeVisible();
  });

  test('11 — Clipped, Listed, Sold counts are visible', async ({ page }) => {
    await page.waitForTimeout(2000);
    for (const label of ['Clipped', 'Listed', 'Sold']) {
      await expect(page.getByText(label)).toBeVisible();
    }
  });

  test('12 — Profit last 7 days widget exists', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.getByText('Profit', { exact: false })).toBeVisible();
    await expect(page.getByText('Last 7 Days', { exact: false })).toBeVisible();
  });
});


// ═══════════════════════════════════════════════════════════════════
//  QUIKEVAL TESTS
// ═══════════════════════════════════════════════════════════════════
test.describe('QUIKEVAL', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/QuikEval`, { waitUntil: 'networkidle' });
  });

  test('13 — "Snap a photo" subtitle exists', async ({ page }) => {
    await expect(page.getByText('Snap a photo', { exact: false })).toBeVisible();
  });

  test('14 — "Take Photo" button exists', async ({ page }) => {
    await expect(page.getByText('Take Photo', { exact: false })).toBeVisible();
  });

  test('15 — "From Library" button exists', async ({ page }) => {
    await expect(page.getByText('From Library', { exact: false })).toBeVisible();
  });

  test('16 — "Flip or Skip?" button exists', async ({ page }) => {
    await expect(page.getByText('Flip or Skip?', { exact: false })).toBeVisible();
  });

  test('17 — Item Specs optional text field exists', async ({ page }) => {
    await expect(page.locator('#itemSpecs')).toBeVisible();
    await expect(page.getByText('Item Specs', { exact: false })).toBeVisible();
  });
});


// ═══════════════════════════════════════════════════════════════════
//  FLIP IT TESTS
// ═══════════════════════════════════════════════════════════════════
test.describe('FLIP IT', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/flip-it`, { waitUntil: 'networkidle' });
  });

  test('18 — "Flip It!" heading exists', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: 'Flip It!' })).toBeVisible();
  });

  test('19 — Generate Listing button exists', async ({ page }) => {
    await expect(page.getByText('Generate Listing', { exact: false })).toBeVisible();
  });

  test('20 — Clip It button exists', async ({ page }) => {
    await expect(page.getByText('Clip It', { exact: true })).toBeVisible();
  });

  test('21 — List It button exists', async ({ page }) => {
    await expect(page.getByText('List It!', { exact: true })).toBeVisible();
  });

  test('22 — "What did you pay?" field exists with red asterisk', async ({ page }) => {
    const label = page.locator('label[for="purchasePrice"]');
    await expect(label).toBeVisible();
    await expect(label.getByText('What did you pay?')).toBeVisible();
    await expect(label.locator('.text-red-500')).toBeVisible();
  });

  test('23 — Internal Notes field exists', async ({ page }) => {
    await expect(page.locator('#internalNotes')).toBeVisible();
  });

  test('24 — Internal Notes label has "Private" text', async ({ page }) => {
    await expect(page.getByText('Private', { exact: false })).toBeVisible();
  });
});


// ═══════════════════════════════════════════════════════════════════
//  MULTIEVAL TESTS
// ═══════════════════════════════════════════════════════════════════
test.describe('MULTIEVAL', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/MultiEval`, { waitUntil: 'networkidle' });
  });

  test('25 — "MultiEval" heading exists', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: 'MultiEval' })).toBeVisible();
  });

  test('26 — "Snap multiple items" subtitle text', async ({ page }) => {
    await expect(page.getByText('Snap multiple items', { exact: false })).toBeVisible();
  });

  test('27 — "Take / Upload Photos" button exists', async ({ page }) => {
    await expect(page.getByText('Take / Upload Photos', { exact: false })).toBeVisible();
  });
});


// ═══════════════════════════════════════════════════════════════════
//  INVENTORY TESTS
// ═══════════════════════════════════════════════════════════════════
test.describe('INVENTORY', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/Inventory`, { waitUntil: 'networkidle' });
    // Wait for items to load
    await page.waitForTimeout(3000);
  });

  test('28 — "My Items" heading exists', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: 'My Items' })).toBeVisible();
  });

  test('29 — All tab exists and is default selected', async ({ page }) => {
    const allTab = page.getByRole('tab', { name: 'All' });
    await expect(allTab).toBeVisible();
    await expect(allTab).toHaveAttribute('data-state', 'active');
  });

  test('30 — Clipped tab exists', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Clipped/i })).toBeVisible();
  });

  test('31 — Listed tab exists', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Listed' })).toBeVisible();
  });

  test('32 — Flipped tab exists', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Flipped' })).toBeVisible();
  });

  test('33 — Search box exists', async ({ page }) => {
    await expect(page.getByPlaceholder('Search items')).toBeVisible();
  });

  test('34 — Sort dropdown exists', async ({ page }) => {
    await expect(page.getByText('Date Added', { exact: false }).or(page.getByText('Sort by'))).toBeVisible();
  });

  test('35 — At least 1 item loads in the All tab', async ({ page }) => {
    const items = page.locator('.cursor-pointer').filter({ has: page.locator('img, svg') });
    await expect(items.first()).toBeVisible({ timeout: 10000 });
  });

  test('36 — Click an item opens edit modal', async ({ page }) => {
    const firstItem = page.locator('.cursor-pointer').filter({ has: page.locator('img, svg') }).first();
    await firstItem.click();
    await expect(page.getByText('Edit Item', { exact: false })).toBeVisible({ timeout: 5000 });
  });

  test('37 — Edit modal has Name field pre-filled (not blank)', async ({ page }) => {
    const firstItem = page.locator('.cursor-pointer').filter({ has: page.locator('img, svg') }).first();
    await firstItem.click();
    await page.waitForTimeout(500);
    const modal = page.locator('.fixed.inset-0');
    const nameInput = modal.locator('input').first();
    const value = await nameInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('38 — Edit modal has Brand field', async ({ page }) => {
    page.locator('.cursor-pointer').filter({ has: page.locator('img, svg') }).first().click();
    await expect(page.getByText('Brand', { exact: true }).first()).toBeVisible({ timeout: 5000 });
  });

  test('39 — Edit modal has Category field', async ({ page }) => {
    page.locator('.cursor-pointer').filter({ has: page.locator('img, svg') }).first().click();
    await expect(page.getByText('Category', { exact: true }).first()).toBeVisible({ timeout: 5000 });
  });

  test('40 — Edit modal has Condition field', async ({ page }) => {
    page.locator('.cursor-pointer').filter({ has: page.locator('img, svg') }).first().click();
    await expect(page.getByText('Condition', { exact: true }).first()).toBeVisible({ timeout: 5000 });
  });

  test('41 — Edit modal has Cost/Purchase Price field', async ({ page }) => {
    page.locator('.cursor-pointer').filter({ has: page.locator('img, svg') }).first().click();
    await expect(page.getByText('Purchase Price', { exact: false })).toBeVisible({ timeout: 5000 });
  });

  test('42 — Edit modal has Internal Notes field', async ({ page }) => {
    page.locator('.cursor-pointer').filter({ has: page.locator('img, svg') }).first().click();
    await expect(page.getByText('Internal Notes', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('43 — Edit modal has Save Changes button', async ({ page }) => {
    page.locator('.cursor-pointer').filter({ has: page.locator('img, svg') }).first().click();
    await expect(page.getByText('Save Changes', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('44 — Edit modal has Delete Item button', async ({ page }) => {
    page.locator('.cursor-pointer').filter({ has: page.locator('img, svg') }).first().click();
    await expect(page.getByText('Delete Item', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('45 — Close modal shows inventory list', async ({ page }) => {
    const firstItem = page.locator('.cursor-pointer').filter({ has: page.locator('img, svg') }).first();
    await firstItem.click();
    await page.waitForTimeout(500);
    const closeBtn = page.locator('button').filter({ has: page.locator('svg.lucide-x') }).first();
    await closeBtn.click();
    await expect(page.locator('h1').filter({ hasText: 'My Items' })).toBeVisible();
    await expect(firstItem).toBeVisible();
  });
});


// ═══════════════════════════════════════════════════════════════════
//  UI / BRANDING TESTS
// ═══════════════════════════════════════════════════════════════════
test.describe('UI / BRANDING', () => {
  test('46 — FlipQuik name appears in header on every page', async ({ page }) => {
    for (const route of ALL_PAGES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      await expect(page.locator('nav').getByText('FlipQuik')).toBeVisible();
    }
  });

  test('47 — No "Base44 APP" in browser tab on any page', async ({ page }) => {
    for (const route of ALL_PAGES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      const title = await page.title();
      expect(title.toLowerCase()).not.toContain('base44');
    }
  });

  test('48 — Pages are not blank/white on load', async ({ page }) => {
    for (const route of ALL_PAGES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length).toBeGreaterThan(10);
    }
  });
});


// ═══════════════════════════════════════════════════════════════════
//  REDIRECT TESTS (purchase price validation)
// ═══════════════════════════════════════════════════════════════════
test.describe('REDIRECT', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/flip-it`, { waitUntil: 'networkidle' });
  });

  test('49 — Clip It without purchase price shows validation error (redirect blocked)', async ({ page }) => {
    await page.click('text=Clip It');
    await expect(page.getByText('Purchase price is required', { exact: false })).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/flip-it/);
  });

  test('50 — List It without purchase price shows validation error (redirect blocked)', async ({ page }) => {
    await page.click('text=List It!');
    await expect(page.getByText('Purchase price is required', { exact: false })).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/flip-it/);
  });
});
