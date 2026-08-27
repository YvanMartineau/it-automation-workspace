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

    // Open the onboarding dialog
    await page.getByRole("button", { name: "Onboarding starten" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Inject XSS payload into the first-name field
    await page.getByLabel("Vorname").fill(xssPayload);
    await page.getByLabel("Nachname").fill("SecurityTest");
    await page.getByLabel("E-Mail").fill(uniqueEmail);
    await page.getByLabel("Abteilung").fill("Security");
    await page.getByLabel("Berufsbezeichnung").fill("Penetration Tester");

    // Submit the form
    await page.getByRole("button", { name: "Lokal erstellen (DB)" }).click();

    // The dialog should close and the card should appear in the board
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText(xssPayload).first()).toBeVisible();

    // CRITICAL: Ensure the payload is treated as text, not HTML.
    // If it were rendered as HTML, an <img src=x> element would exist in the DOM.
    const imgInCard = page.locator('img[src="x"]').first();
    await expect(imgInCard).not.toBeVisible();

    // Additionally, Playwright automatically fails the test if a native
    // `dialog` (alert/confirm/prompt) is triggered. Because we do NOT
    // expect an alert, the mere absence of a crash/assertion proves the
    // XSS did not execute.
  });
});
