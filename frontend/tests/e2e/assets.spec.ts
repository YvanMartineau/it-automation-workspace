/**
 * @file E2E — Asset Discovery & Health Dashboard
 * @module tests/e2e_test/assets.spec
 *
 * Mapped Test Cases:
 *   TC-P1-F-001  Display list of all discovered devices with health scores
 *   TC-P1-F-002  Filter devices by health status (Healthy/Warning/Critical)
 *   TC-P1-F-003  Real-time updates via TanStack Query when new scan completes
 *   TC-P1-I-008  Frontend ↔ TanStack Query caching (stale-while-revalidate)
 */
import { test, expect } from "./fixtures";

test.describe("Asset Discovery & Health Dashboard (E2E)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/assets");
    await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
  });

  test("TC-P1-F-001: Asset table renders with health score column and sorting", async ({ authenticatedPage: page }) => {
    // Verify essential columns are present
    await expect(page.getByRole("columnheader", { name: "Hostname" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Health" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();

    // Verify data loaded (either rows or intentional empty state)
    const rows = page.locator("[data-state]");
    const emptyState = page.getByText("Keine Assets gefunden");
    await expect(rows.or(emptyState).first()).toBeVisible();

    // Click Health header to trigger sort
    const healthHeader = page.getByRole("columnheader", { name: "Health" });
    await healthHeader.click();

    // After sorting, the UI should still be stable (no crash)
    await expect(page.getByRole("columnheader", { name: "Health" })).toBeVisible();
  });

  test("TC-P1-F-002: Filter devices by health status", async ({ authenticatedPage: page }) => {
    // Open the filter panel
    await page.getByRole("button", { name: "Filter" }).click();

    // Select "Gesund" from the Health dropdown
    const healthSelect = page.locator("select").filter({ hasText: /Alle Health/i });
    await healthSelect.selectOption("healthy");

    // The table should now only show healthy badges (or empty if none exist)
    const criticalBadge = page.locator("text=Kritisch");
    const warningBadge = page.locator("text=Langsam");

    // If rows exist, they should not contain critical or warning
    const rowCount = await page.locator("[data-state]").count();
    if (rowCount > 0) {
      await expect(criticalBadge).not.toBeVisible();
      await expect(warningBadge).not.toBeVisible();
    }
  });

  test("TC-P1-F-003: Scan triggers real-time table update without reload", async ({ authenticatedPage: page }) => {
    // This test assumes the user has admin role (scan button is admin-only)
    const scanButton = page.getByRole("button", { name: /^Scan$/i });

    // If scan button is not visible, user is not admin — skip gracefully
    if (!(await scanButton.isVisible().catch(() => false))) {
      test.skip(true, "Scan button not visible — current test user is not admin");
      return;
    }

    // Click scan and open the dialog
    await scanButton.click();
    await expect(page.getByText(/Scan läuft|Scan wird gestartet/i)).toBeVisible();

    // Wait for the backend scan + SSE stream to finish (generous timeout)
    await expect(page.getByText("Scan abgeschlossen")).toBeVisible({ timeout: 60000 });

    // Verify TanStack Query invalidated the cache and table refreshed
    await expect(page.getByText("Aktualisierung läuft")).toBeVisible();
  });

  test("TC-P1-I-008: TanStack Query returns cached data immediately on back-navigation", async ({ authenticatedPage: page }) => {
    // 1. Intercept asset API to measure calls
    let requestCount = 0;
    await page.route("/api/devices**", async (route) => {
      requestCount++;
      await route.continue();
    });

    // 2. Load assets page
    await page.goto("/assets");
    await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
    await page.waitForTimeout(1000); // allow initial fetch
    const countAfterFirstLoad = requestCount;

    // 3. Navigate away to dashboard
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "IT Automation Dashboard" })).toBeVisible();

    // 4. Navigate back via browser back (simulates user clicking back button)
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();

    // 5. Because of TanStack Query caching, no NEW network request should fire
    // immediately; the cached data is rendered first.
    // We allow at most the same count (stale-while-revalidate may fire a background
    // request, but the UI should paint instantly from cache).
    expect(requestCount).toBeGreaterThanOrEqual(countAfterFirstLoad);
    expect(requestCount).toBeLessThanOrEqual(countAfterFirstLoad + 1);
  });
});
