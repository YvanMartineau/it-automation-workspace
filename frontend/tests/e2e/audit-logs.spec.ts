/**
 * @file E2E — Audit Logging
 * @module tests/e2e_test/audit-logs.spec
 *
 * Mapped Test Cases:
 *   TC-P1-F-030  Query logs by date range and actor — pagination works
 *   TC-P1-F-031  Query with invalid date range (end < start) → 400 error
 *   TC-P1-F-028  Login event is recorded (verified here from audit side)
 */
import { test, expect, TEST_USER } from "./fixtures";

test.describe("Audit Logging (E2E)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/audit-logs");
    await expect(page.getByRole("heading", { name: "Audit Logs" })).toBeVisible();
  });

  test("TC-P1-F-030: Query logs by date range and actor", async ({ authenticatedPage: page }) => {
    const today = new Date().toISOString().split("T")[0];

    // Set date range to today → today
    await page.locator("#audit-start-date").fill(today);
    await page.locator("#audit-end-date").fill(today);

    // If actor dropdown has options, select the first real actor
    const actorSelect = page.locator("select").filter({ hasText: /Alle Akteure/i });
    const optionCount = await actorSelect.locator("option").count();
    if (optionCount > 1) {
      await actorSelect.selectOption({ index: 1 });
    }

    // Wait for table to reflect filtered results
    await expect(page.getByRole("table")).toBeVisible();

    // Verify pagination controls exist and are functional
    const nextButton = page.getByRole("button", { name: "Weiter" });
    const prevButton = page.getByRole("button", { name: "Zurück" });

    // Previous should be disabled on first page
    await expect(prevButton).toBeDisabled();

    // Next may be enabled or disabled depending on result count
    await expect(nextButton).toBeVisible();
  });

  test("TC-P1-F-031: Invalid date range (end < start) shows error", async ({ authenticatedPage: page }) => {
    await page.locator("#audit-start-date").fill("2025-12-01");
    await page.locator("#audit-end-date").fill("2025-01-01"); // end < start

    // The frontend sends the request; the backend should return 400.
    // We wait for either an error toast or an inline error message.
    const errorIndicator = page.getByText(/ungültig|invalid|fehler|error/i).first();
    await expect(errorIndicator).toBeVisible({ timeout: 5000 });
  });
});

// Stand-alone test for login audit event — uses a fresh browser context
test("TC-P1-F-028: Login event is recorded in audit logs", async ({ browser, authenticatedPage: page }) => {
  // 1. Perform a fresh login in an isolated context
  const context = await browser.newContext();
  const freshPage = await context.newPage();

  await freshPage.goto("/login");
  await freshPage.getByLabel("E-Mail").fill(TEST_USER.email);
  await freshPage.getByLabel("Passwort").fill(TEST_USER.password);
  await freshPage.getByRole("button", { name: "Anmelden" }).click();
  await expect(freshPage).toHaveURL("/dashboard");
  await context.close();

  // 2. Refresh the audit-log page and look for the login entry
  await page.reload();
  await expect(page.getByText("Anmeldung").first()).toBeVisible();
});
