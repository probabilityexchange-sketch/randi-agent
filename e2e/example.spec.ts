import { test, expect } from '@playwright/test';

test.describe('Randi Agent Platform', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await expect(page).toHaveTitle(/Randi/);
    
    // Check for key elements
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle navigation', async ({ page }) => {
    await page.goto('/');
    
    // Add navigation tests here
    // Example:
    // await page.click('[data-testid="nav-link"]');
    // await expect(page).toHaveURL(/.+/);
  });
});
