/**
 * @file Shared E2E fixtures — Authentication helper
 * @module tests/e2e_test/fixtures
 *
 * These fixtures handle the authentication bootstrap required by the app.
 * Because useAuth.ts only persists `isAuthenticated` to localStorage (not the
 * token), we must:
 *   1. Call /api/auth/login via Playwright's request context to obtain the
 *      httpOnly refresh_token cookie.
 *   2. Seed localStorage so AuthBootstrapGate recognises a session.
 *   3. Hard-navigate to a protected route so the gate calls /auth/refresh.
 *
 * Environment variables (optional):
 *   TEST_USER_EMAIL    — defaults to admin@company.com
 *   TEST_USER_PASSWORD — defaults to TestPassword123!
 */
import { test as base, expect, Page } from "@playwright/test";

export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || "admin@company.com",
  password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
};

/**
 * Authenticate a page for E2E tests.
 */
export async function authenticatePage(page: Page): Promise<void> {
  // 1. Direct API login → sets httpOnly refresh_token cookie in page context
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

  // 2. Seed localStorage so AuthBootstrapGate sees an authenticated session
  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.setItem(
      "it-dashboard-auth",
      JSON.stringify({ state: { isAuthenticated: true }, version: 0 })
    );
  });

  // 3. Navigate to dashboard — gate will exchange cookie for access token
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
  // Renamed 'use' → 'fixtureUse' to avoid react-hooks/rules-of-hooks false positive
  authenticatedPage: async ({ page }, fixtureUse) => {
    await authenticatePage(page);
    await fixtureUse(page);
    // Cleanup: clear storage so the next test starts clean
    await page.evaluate(() => localStorage.clear());
  },
});

export { expect };
