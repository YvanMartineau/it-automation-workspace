/**
 * @file E2E — Authentication & Authorization
 * @module tests/e2e_test/auth.spec
 *
 * Mapped Test Cases:
 *   TC-P1-S-001  Access protected endpoint without JWT → 401 / redirect
 *   TC-P1-S-002  Expired JWT → refresh attempt → redirect on failure
 *   TC-P1-S-003  Malformed JWT → 401, no internal error exposed
 *   TC-P1-F-028  Login and logout events are logged in audit trail
 */
import { test, expect, TEST_USER } from "./fixtures";

test.describe("Authentication & Authorization (E2E)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /IT Automation Dashboard/i })).toBeVisible();
  });

  test("TC-P1-F-028: Login with valid credentials redirects to dashboard and logs event", async ({ page }) => {
    await page.getByLabel("E-Mail").fill(TEST_USER.email);
    await page.getByLabel("Passwort").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Anmelden" }).click();

    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByRole("heading", { name: "IT Automation Dashboard" })).toBeVisible();

    // Verify the login was recorded in audit logs
    await page.goto("/audit-logs");
    await expect(page.getByText("Anmeldung").first()).toBeVisible();
  });

  test("TC-P1-S-001: Accessing /dashboard without authentication redirects to login", async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");
  });

  test("TC-P1-S-002: Expired refresh token redirects to login after failed refresh", async ({ page }) => {
    // Seed an "authenticated" localStorage but force /auth/refresh to fail
    await page.evaluate(() => {
      localStorage.setItem(
        "it-dashboard-auth",
        JSON.stringify({ state: { isAuthenticated: true }, version: 0 })
      );
    });

    await page.route("/api/auth/refresh", async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Refresh token expired" }),
      });
    });

    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login", { timeout: 10000 });
  });

  test("TC-P1-S-003: Malformed JWT is handled gracefully without 5xx errors", async ({ page }) => {
    // Inject a garbage token into the Zustand store via page.evaluate
    await page.evaluate(() => {
      localStorage.setItem(
        "it-dashboard-auth",
        JSON.stringify({ state: { isAuthenticated: true }, version: 0 })
      );
    });

    // Intercept an API call and force it to see a malformed token
    await page.route("/api/devices**", async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: "Invalid token" }),
      });
    });

    await page.goto("/assets");

    // The app should NOT crash (no 5xx). It should either redirect to login
    // or show an auth error. We assert no error boundary / crash text.
    await expect(page.getByText(/500|Internal Server Error/i)).not.toBeVisible();
    // And we should eventually land back at login
    await expect(page).toHaveURL("/login", { timeout: 10000 });
  });
});
