/**
 * @file E2E — Security & Input Sanitization
 * @module tests/e2e_test/security.spec
 *
 * Mapped Test Cases:
 *   TC-P1-S-010  XSS payload in form fields → sanitised, not rendered as HTML
 */
import { test, expect } from "./fixtures";

test.describe("Security — XSS & Input Sanitization (E2E)", () => {
  test("TC-P1-S-010: XSS payload in onboarding form is sanitised and not executed", async ({ authenticatedPage: page }) => {
    const xssPayload = '<img src=x onerror="alert(1)">';
    const uniqueEmail = `xss.${Date.now()}@company.com`;

    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Onboarding Tracker" })).toBeVisible();

    // ✅ FIX: Disambiguate the onboarding dialog by filtering for a unique field it contains
    const onboardingDialog = page.getByRole("dialog").filter({ has: page.getByLabel("Vorname") });

    // Open the onboarding dialog
    await page.getByRole("button", { name: "Onboarding starten" }).click();
    await expect(onboardingDialog).toBeVisible();

    // Inject XSS payload into the first-name field
    await page.getByLabel("Vorname").fill(xssPayload);
    await page.getByLabel("Nachname").fill("SecurityTest");
    await page.getByLabel("E-Mail").fill(uniqueEmail);
    await page.getByLabel("Abteilung").fill("Security");
    await page.getByLabel("Berufsbezeichnung").fill("Penetration Tester");

    // Submit the form
    await page.getByRole("button", { name: "openLDAP" }).click();

    // ✅ FIX: Assert that the specific onboarding dialog is now closed
    await expect(onboardingDialog).not.toBeVisible();

    // The card should appear in the board with the payload rendered as safe text
    await expect(page.getByText(xssPayload).first()).toBeVisible();

    // CRITICAL: Ensure the payload is treated as text, not HTML.
    const imgInCard = page.locator('img[src="x"]').first();
    await expect(imgInCard).not.toBeVisible();
  });
});
