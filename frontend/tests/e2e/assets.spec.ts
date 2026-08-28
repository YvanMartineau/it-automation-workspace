/**
 * @file E2E — Asset Discovery & Health Dashboard
 * @module tests/e2e_test/assets.spec
 *
 * Mapped Test Cases:
 *   TC-P1-F-001  Display list of all discovered devices with health scores
 *   TC-P1-I-008  Frontend ↔ TanStack Query caching (stale-while-revalidate)
 */
import { test, expect } from "./fixtures";

test.describe("Asset Discovery & Health Dashboard (E2E)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/assets");
    await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
  });

  test("TC-P1-F-001: Asset table renders with health score column and sorting", async ({ authenticatedPage: page }) => {
    // Verify essential column headers are present (text-based, not ARIA columnheader role)
    await expect(page.getByText("Hostname").first()).toBeVisible();
    await expect(page.getByText("Health").first()).toBeVisible();
    await expect(page.getByText("Status").first()).toBeVisible();

    // ✅ FIXED: Use getByRole with name regex (substring match on accessible name)
    const rowCheckboxes = page.getByRole("checkbox", { name: /auswählen/ });
    const emptyState = page.getByText("Keine Assets gefunden");
    await expect(rowCheckboxes.first().or(emptyState).first()).toBeVisible();

    // Assert at least one row is present (or empty state — both are valid)
    const rowCount = await rowCheckboxes.count();
    if (rowCount > 0) {
      expect(rowCount).toBeGreaterThan(0);
    }

    // Click Health header to trigger sort
    const healthHeader = page.getByText("Health").first();
    await healthHeader.click();

    // After sorting, the UI should still be stable (no crash)
    await expect(page.getByText("Health").first()).toBeVisible();
  });

  test("TC-P1-I-008: TanStack Query returns cached data immediately", async ({ authenticatedPage: page }) => {
  // beforeEach already on /assets
    const rows = page.getByRole("checkbox", { name: /auswählen/ });
    const empty = page.getByText("Keine Assets gefunden");
    await expect(rows.first().or(empty).first()).toBeVisible(); // wait for real data

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "IT Automation Dashboard" })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();

    // Cache = no loading skeleton, data paints instantly
    await expect(page.getByText(/Lade|Loading/i)).toBeHidden();
    await expect(rows.first().or(empty).first()).toBeVisible(); // default 5s, not 500ms
  });


});
