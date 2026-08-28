/**
 * @file Shared E2E fixtures — Authentication helper
 * @module tests/e2e_test/fixtures
 *
 * Environment variables (optional):
 *   TEST_USER_EMAIL    — defaults to admin@dev.de
 *   TEST_USER_PASSWORD — defaults to DemoAdmin!2026
 */
import { test as base, expect, Page } from "@playwright/test";

export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || "admin@dev.de",
  password: process.env.TEST_USER_PASSWORD || "DemoAdmin!2026",
};

/**
 * Authenticate a page for E2E tests.
 */
export async function authenticatePage(page: Page): Promise<void> {
  // STEP 0: Navigate to login page first so the browser has a valid origin.
  //         This allows relative API URLs like /api/auth/login to resolve.
  await page.goto("/login");

  // STEP 1: Direct API login → sets httpOnly refresh_token cookie in page context
  const loginResponse = await page.request.post("/api/auth/login", {
    data: {
      email: TEST_USER.email,
      password: TEST_USER.password,
    },
  });
  expect(
    loginResponse.ok(),
    `API login failed: ${await loginResponse.text()}`
  ).toBeTruthy();

  // STEP 2: Seed localStorage so AuthBootstrapGate sees an authenticated session
  await page.evaluate(() => {
    localStorage.setItem(
      "it-dashboard-auth",
      JSON.stringify({ state: { isAuthenticated: true }, version: 0 })
    );
  });

  // STEP 3: Navigate to dashboard — gate will exchange cookie for access token
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/dashboard");

  // Confirm we are truly logged in
  await expect(
    page.getByRole("heading", { name: /IT Automation Dashboard/i })
  ).toBeVisible();
}

export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page }, fixtureUse) => {
    await authenticatePage(page);
    await fixtureUse(page);
    // Cleanup: clear storage so the next test starts clean
    await page.evaluate(() => localStorage.clear());
  },
});

export { expect };