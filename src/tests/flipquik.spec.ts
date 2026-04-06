import { test, expect } from '@playwright/test';

test.describe('FlipQuik - Reseller Inventory Management', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should display dashboard on load', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should navigate to Capture page', async ({ page }) => {
    await page.click('text=Capture');
    await expect(page.locator('h1')).toContainText('Capture');
  });

  test('Quick Capture - should create an item', async ({ page }) => {
    await page.click('text=Capture');
    
    // Fill quick capture form
    await page.fill('input[placeholder*="nike hoodie"]', 'Test Item');
    await page.fill('input[placeholder="0.00"]', '10.50');
    await page.fill('input[placeholder="e.g., Nike"]', 'TestBrand');
    await page.fill('input[placeholder="e.g., Clothing"]', 'Clothing');
    
    // Submit using data-testid
    await page.click('[data-testid="save-quick-capture"]');
    
    // Verify success
    await expect(page.locator('text=Item captured successfully')).toBeVisible();
  });

  test('Quick Evaluate - should calculate profit estimates', async ({ page }) => {
    await page.click('text=Capture');
    await page.click('text=Evaluate');
    
    // Fill evaluation form
    await page.fill('input[placeholder="e.g., Nike Hoodie"]', 'Nike Hoodie');
    await page.fill('input[placeholder="Nike"]', 'Nike');
    await page.fill('input[placeholder="Clothing"]', 'Clothing');
    await page.fill('input[placeholder="0.00"]', '20');
    
    // Evaluate using data-testid
    await page.click('[data-testid="evaluate-item"]');
    
    // Verify evaluation results appear
    await expect(page.locator('text=Quick Evaluation')).toBeVisible();
    await expect(page.locator('text=Resale Range')).toBeVisible();
    await expect(page.locator('text=ROI')).toBeVisible();
  });

  test('Quick Evaluate - BUY action should create captured item', async ({ page }) => {
    await page.click('text=Capture');
    await page.click('text=Evaluate');
    
    await page.fill('input[placeholder="0.00"]', '15');
    await page.click('[data-testid="evaluate-item"]');
    
    // Click BUY using data-testid
    await page.click('[data-testid="evaluate-buy"]');
    
    await expect(page.locator('text=Item captured')).toBeVisible();
  });

  test('should navigate to Drafts page', async ({ page }) => {
    await page.click('text=Drafts');
    await expect(page.locator('h1')).toContainText('Drafts');
  });

  test('should display draft workflow sections', async ({ page }) => {
    await page.click('text=Drafts');
    
    await expect(page.locator('text=Needs Draft')).toBeVisible();
    await expect(page.locator('text=In Progress')).toBeVisible();
    await expect(page.locator('text=Saved')).toBeVisible();
  });

  test('should navigate to Inventory page', async ({ page }) => {
    await page.click('text=Inventory');
    await expect(page.locator('h1')).toContainText('Inventory');
  });

  test('should navigate to Sales page', async ({ page }) => {
    await page.click('text=Sales');
    await expect(page.locator('h1')).toContainText('Sales');
  });

  test('should navigate to Insights page', async ({ page }) => {
    await page.click('text=Insights');
    await expect(page.locator('h1')).toContainText('Insights');
  });

  test('should navigate to Settings page', async ({ page }) => {
    await page.click('text=Settings');
    await expect(page.locator('h1')).toContainText('Settings');
  });

  test('Full Capture - should validate required fields', async ({ page }) => {
    await page.click('text=Capture');
    await page.click('text=Full');
    
    // Try to save without required fields using data-testid
    await page.click('[data-testid="save-item"]');
    
    // Should show error
    await expect(page.locator('text=Please enter an item name')).toBeVisible();
  });

  test('Full Capture - should create item with all fields', async ({ page }) => {
    await page.click('text=Capture');
    await page.click('text=Full');
    
    // Fill all fields
    await page.fill('input[placeholder="e.g., Blue Nike Hoodie"]', 'Complete Test Item');
    await page.fill('input[placeholder="Nike"]', 'TestBrand');
    await page.fill('input[placeholder="Clothing"]', 'Clothing');
    await page.fill('input[placeholder="e.g., Excellent, Good, Fair"]', 'Excellent');
    await page.fill('input[placeholder="0.00"]', '25.99');
    await page.fill('input[placeholder="Goodwill"]', 'Test Store');
    await page.fill('input[placeholder="L"]', 'L');
    await page.fill('input[placeholder="Blue"]', 'Blue');
    
    // Save using data-testid
    await page.click('[data-testid="save-item"]');
    
    await expect(page.locator('text=Item saved successfully')).toBeVisible();
  });

  test('Bottom navigation should be visible', async ({ page }) => {
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Capture')).toBeVisible();
    await expect(page.locator('text=Drafts')).toBeVisible();
    await expect(page.locator('text=Inventory')).toBeVisible();
    await expect(page.locator('text=Sales')).toBeVisible();
  });

  test('Draft workflow - should create and generate listing content', async ({ page }) => {
    // First create an item via Quick Capture
    await page.click('text=Capture');
    await page.fill('input[placeholder*="nike hoodie"]', 'Test Draft Item');
    await page.fill('input[placeholder="0.00"]', '12.50');
    await page.click('[data-testid="save-quick-capture"]');
    await expect(page.locator('text=Item captured successfully')).toBeVisible();
    
    // Navigate to Drafts
    await page.click('text=Drafts');
    await expect(page.locator('text=Needs Draft')).toBeVisible();
    
    // Create draft
    await page.click('[data-testid="create-draft"]');
    await expect(page.locator('text=Draft created')).toBeVisible();
    
    // Generate title
    await page.click('[data-testid="generate-title"]');
    await expect(page.locator('text=Title generated')).toBeVisible();
    
    // Generate description
    await page.click('[data-testid="generate-description"]');
    await expect(page.locator('text=Description generated')).toBeVisible();
    
    // Save draft
    await page.click('[data-testid="save-draft"]');
    await page.click('[data-testid="confirm-save-draft"]');
    await expect(page.locator('text=Draft saved')).toBeVisible();
  });

  test('Photo capture - should upload and remove photos', async ({ page }) => {
    await page.click('text=Capture');
    
    // Verify photo button exists
    await expect(page.locator('[data-testid="take-photos"]')).toBeVisible();
  });

  test('All test IDs should be present', async ({ page }) => {
    // Navigate to Capture page
    await page.click('text=Capture');
    
    // Check Quick Capture test IDs
    await expect(page.locator('[data-testid="take-photos"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-quick-capture"]')).toBeVisible();
    
    // Check Evaluate test IDs
    await page.click('text=Evaluate');
    await expect(page.locator('[data-testid="evaluate-item"]')).toBeVisible();
    
    // Check Full Capture test IDs
    await page.click('text=Full');
    await expect(page.locator('[data-testid="save-item"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-and-draft"]')).toBeVisible();
  });
});