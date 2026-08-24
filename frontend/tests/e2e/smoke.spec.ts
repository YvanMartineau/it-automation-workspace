import { test, expect } from '@playwright/test';

test.describe('Frontend Smoke Tests', () => {
  
  test('Application loads and renders login page', async ({ page }) => {
    // Navigate to your running Vite frontend (adjust port if running locally or via Docker)
    await page.goto('http://localhost:5173');

    // 1. Verify the app title or main branding loads
    await expect(page).toHaveTitle(/IT Automation/i);

    // 2. Check that key UI elements (like email/password inputs or login button) exist
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const loginButton = page.locator('button[type="submit"], button:has-text("Login")');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();
  });

  test('Invalid login shows UI error message', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Fill in wrong credentials
    await page.fill('input[type="email"], input[name="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'badpassword');
    
    // Click submit
    await page.click('button[type="submit"], button:has-text("Login")');

    // Verify that an error banner or toast appears cleanly without crashing the UI
    const errorAlert = page.locator('.error, [role="alert"], text=/invalid|error|unauthorized/i');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
  });

});