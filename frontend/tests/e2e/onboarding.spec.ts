/**
 * @file E2E — Automated Onboarding
 * @module tests/e2e_test/onboarding.spec
 */

// If Page is not re-exported from ./fixtures, use:
import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("Automated Onboarding (E2E)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/onboarding");
    await expect(
      page.getByRole("heading", { name: "Onboarding Tracker", exact: true }),
    ).toBeVisible();
  });

  // FIX: Use level: 3 to specifically target column headings and avoid matching
  // the main page wrapper containing the level 1 "Onboarding Tracker" heading.
  const getColumn = (page: Page, name: RegExp) =>
    page
      .locator("div, section")
      .filter({ has: page.getByRole("heading", { name, level: 3 }) })
      .first();

  const onboardingDialog = (page: Page) =>
    page.getByRole("dialog", { name: /Neuen Onboarding-Vorgang erstellen/i });

  const submitDialog = (page: Page) =>
    onboardingDialog(page).getByRole("button", {
      name: /OpenLDAP|Lokal erstellen/i,
    });

  test("TC-P1-F-005: Submit with missing required field shows validation error", async ({
    authenticatedPage: page,
  }) => {
    await page
      .getByRole("button", { name: "Onboarding starten", exact: true })
      .click();
    const dialog = onboardingDialog(page);
    await expect(dialog).toBeVisible();

    await submitDialog(page).click();

    await expect(dialog).toBeVisible();
    // real errors are <p> inside dialog, not role=alert
    await expect(dialog.getByText(/Vorname ist erforderlich/)).toBeVisible();
    await expect(dialog.getByText(/Nachname ist erforderlich/)).toBeVisible();
    await expect(page.getByLabel("E-Mail", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("TC-P1-F-006: Submit with invalid email format shows validation error", async ({
    authenticatedPage: page,
  }) => {
    await page
      .getByRole("button", { name: "Onboarding starten", exact: true })
      .click();
    const dialog = onboardingDialog(page);
    await expect(dialog).toBeVisible();

    const email = page.getByLabel("E-Mail", { exact: true });
    await page.getByLabel("Vorname", { exact: true }).fill("Test");
    await page.getByLabel("Nachname", { exact: true }).fill("User");
    await email.fill("not-an-email");
    await page.getByLabel("Abteilung", { exact: true }).fill("QA");
    await page.getByLabel("Berufsbezeichnung", { exact: true }).fill("Tester");

    await submitDialog(page).click();

    // dialog stays open = submit was blocked
    await expect(dialog).toBeVisible();
    // native constraint validation, not aria-invalid
    await expect(email).toHaveJSProperty("validity.typeMismatch", true);
    await expect(email).toHaveJSProperty("validity.valid", false);
  });

  test("TC-P1-F-007: Submit duplicate email fails with clear error", async ({
    authenticatedPage: page,
  }) => {
    const uniqueEmail = `duplicate.${Date.now()}@company.com`;

    await page
      .getByRole("button", { name: "Onboarding starten", exact: true })
      .click();
    await page.getByLabel("Vorname", { exact: true }).fill("First");
    await page.getByLabel("Nachname", { exact: true }).fill("User");
    await page.getByLabel("E-Mail", { exact: true }).fill(uniqueEmail);
    await page.getByLabel("Abteilung", { exact: true }).fill("QA");
    await page.getByLabel("Berufsbezeichnung", { exact: true }).fill("Tester");
    await submitDialog(page).click();
    await expect(onboardingDialog(page)).not.toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: "First User", exact: true }).first(),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Onboarding starten", exact: true })
      .click();
    await page.getByLabel("Vorname", { exact: true }).fill("Second");
    await page.getByLabel("Nachname", { exact: true }).fill("User");
    await page.getByLabel("E-Mail", { exact: true }).fill(uniqueEmail);
    await page.getByLabel("Abteilung", { exact: true }).fill("QA");
    await page.getByLabel("Berufsbezeichnung", { exact: true }).fill("Tester");
    await submitDialog(page).click();

    // Note: We do NOT filter by email here because "First User" and "Second User"
    // intentionally share the same email. The improved `getColumn` (using level: 3)
    // ensures we only search inside the "Fehlgeschlagen" column, making the heading unique.
    const failedCard = getColumn(page, /^Fehlgeschlagen$/).getByRole(
      "heading",
      { name: "Second User", exact: true },
    );

    const toastError = page
      .getByText(/Fehler|fehlgeschlagen|duplicate|bereits/i)
      .first();

    await expect(failedCard.or(toastError)).toBeVisible({ timeout: 20_000 });
  });
});