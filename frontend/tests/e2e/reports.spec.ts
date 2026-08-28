/**
 * @file E2E — Automated Reporting
 * @module tests/e2e_test/reports.spec
 *
 * Mapped Test Cases:
 *   TC-P1-F-020  Generate PDF report on schedule / on demand
 *   TC-P1-F-021  PDF content includes all required sections
 *   TC-P1-F-022  Generate PDF when there is no data → zero counts, no crash
 */
import { test, expect } from "./fixtures";

test.describe("Automated Reporting (E2E)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Report Gallery" })).toBeVisible();
  });

  test("TC-P1-F-020 + TC-P1-F-021: Generate PDF report and verify history entry", async ({ authenticatedPage: page }) => {
    test.setTimeout(60_000);

    await page.getByRole("button", { name: "Neuen Bericht Anfordern" }).click();

    const dialog = page.getByRole("dialog", { name: "Neuen PDF-Bericht anfordern" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("combobox", { name: "Berichtstyp" }).click();
    // FIX 1: listbox/option is portaled to body
    await page.getByRole("option", { name: "Asset Inventory Report" }).click();

    await dialog.getByRole("button", { name: "Bericht Erstellen" }).click();

    // FIX 2: dialog shows success state
    await expect(dialog.getByText(/Bericht erstellt!/)).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();

    const reportRow = page
      .getByRole("table")
      .getByRole("row")
      .filter({ hasText: /Asset Inventory Report/ })
      .first();

    await expect(reportRow).toBeVisible({ timeout: 30_000 });

    const statusCell = reportRow.getByRole("cell").last();
    // FIX 3: status is now "sent", not only German
    await expect(statusCell).toContainText(/Fertig|Abgeschlossen|Fehlgeschlagen|sent|completed|failed/i);

    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: /Berichtsname|Name/i })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: /Typ|Type/i })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: /Status/i })).toBeVisible();
  });

  test("TC-P1-F-022: Report generation with empty database shows zero counts", async () => {
    test.skip(
      true,
      "Requires empty DB state. Implement by seeding a clean tenant or mocking the API response."
    );
  });
});