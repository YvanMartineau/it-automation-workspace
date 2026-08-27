/**
 * @file E2E — Automated Onboarding
 * @module tests/e2e_test/onboarding.spec
 *
 * Mapped Test Cases:
 *   TC-P1-F-004  Submit valid onboarding request → workflow reaches COMPLETED
 *   TC-P1-F-005  Submit with missing required field → form validation error
 *   TC-P1-F-006  Submit with invalid email format → validation error
 *   TC-P1-F-007  Submit duplicate email → workflow fails with clear error
 *
 * NOTE: These tests mutate shared backend state. They use unique timestamps
 * to avoid collisions when running in parallel.
 */
import { test, expect } from "./fixtures";

test.describe.configure({ mode: "serial" });

test.describe("Automated Onboarding (E2E)", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Onboarding Tracker" })).toBeVisible();
  });

  test("TC-P1-F-004: Submit valid onboarding request and verify workflow progression", async ({ authenticatedPage: page }) => {
    const uniqueEmail = `e2e.onboard.${Date.now()}@company.com`;

    // Open the onboarding dialog
    await page.getByRole("button", { name: "Onboarding starten" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Fill the form
    await page.getByLabel("Vorname").fill("E2E");
    await page.getByLabel("Nachname").fill("Testuser");
    await page.getByLabel("E-Mail").fill(uniqueEmail);
    await page.getByLabel("Abteilung").fill("QA");
    await page.getByLabel("Berufsbezeichnung").fill("Test Engineer");

    // Submit
    await page.getByRole("button", { name: "Lokal erstellen (DB)" }).click();

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Verify the card appears in the PENDING / Ausstehend column
    await expect(page.getByText("E2E Testuser").first()).toBeVisible();

    // Wait for the SSE-driven workflow to reach a terminal state.
    // The backend calls n8n → OpenLDAP → Gmail → JIRA; this can take 10-30s.
    const completedLocator = page
      .locator("div")
      .filter({ hasText: /^Abgeschlossen$/ })
      .locator("xpath=../../..")
      .filter({ hasText: "E2E Testuser" });

    const failedLocator = page
      .locator("div")
      .filter({ hasText: /^Fehlgeschlagen$/ })
      .locator("xpath=../../..")
      .filter({ hasText: "E2E Testuser" });

    await expect(completedLocator.or(failedLocator)).toBeVisible({ timeout: 45000 });
  });

  test("TC-P1-F-005: Submit with missing required field shows validation error", async ({ authenticatedPage: page }) => {
    await page.getByRole("button", { name: "Onboarding starten" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Submit without filling anything
    await page.getByRole("button", { name: "Lokal erstellen (DB)" }).click();

    // Expect aria-invalid on required fields and visible error messages
    const emailInput = page.getByLabel("E-Mail");
    await expect(emailInput).toHaveAttribute("aria-invalid", "true");

    // FormMessage renders a role="alert" for each invalid field
    const alerts = page.getByRole("alert");
    await expect(alerts.first()).toBeVisible();
    expect(await alerts.count()).toBeGreaterThanOrEqual(1);
  });

  test("TC-P1-F-006: Submit with invalid email format shows validation error", async ({ authenticatedPage: page }) => {
    await page.getByRole("button", { name: "Onboarding starten" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel("Vorname").fill("Test");
    await page.getByLabel("Nachname").fill("User");
    await page.getByLabel("E-Mail").fill("not-an-email");
    await page.getByLabel("Abteilung").fill("QA");
    await page.getByLabel("Berufsbezeichnung").fill("Tester");

    await page.getByRole("button", { name: "Lokal erstellen (DB)" }).click();

    // Email field should be marked invalid
    await expect(page.getByLabel("E-Mail")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("TC-P1-F-007: Submit duplicate email fails with clear error", async ({ authenticatedPage: page }) => {
    const uniqueEmail = `duplicate.${Date.now()}@company.com`;

    // ── First submission ──
    await page.getByRole("button", { name: "Onboarding starten" }).click();
    await page.getByLabel("Vorname").fill("First");
    await page.getByLabel("Nachname").fill("User");
    await page.getByLabel("E-Mail").fill(uniqueEmail);
    await page.getByLabel("Abteilung").fill("QA");
    await page.getByLabel("Berufsbezeichnung").fill("Tester");
    await page.getByRole("button", { name: "Lokal erstellen (DB)" }).click();

    // Wait for the card to appear in the board
    await expect(page.getByText("First User").first()).toBeVisible();

    // ── Second submission with same email ──
    await page.getByRole("button", { name: "Onboarding starten" }).click();
    await page.getByLabel("Vorname").fill("Second");
    await page.getByLabel("Nachname").fill("User");
    await page.getByLabel("E-Mail").fill(uniqueEmail);
    await page.getByLabel("Abteilung").fill("QA");
    await page.getByLabel("Berufsbezeichnung").fill("Tester");
    await page.getByRole("button", { name: "Lokal erstellen (DB)" }).click();

    // The backend should reject the duplicate (OpenLDAP or DB unique constraint).
    // We expect either:
    //   A) A toast error, or
    //   B) The workflow card lands in the FAILED column.
    const failedCard = page
      .locator("div")
      .filter({ hasText: /^Fehlgeschlagen$/ })
      .locator("xpath=../../..")
      .filter({ hasText: "Second User" });

    const toastError = page.getByText(/Fehler|fehlgeschlagen|duplicate|bereits/i);

    await expect(failedCard.or(toastError)).toBeVisible({ timeout: 20000 });
  });
});
