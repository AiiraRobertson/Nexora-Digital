const { test, expect } = require("@playwright/test");

test.describe("Nexora Digital landing page", () => {
  test("homepage loads with the hero and primary sections", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Nexora Digital/);
    await expect(page.locator("#hero-title")).toBeVisible();

    // Each in-page nav target exists.
    for (const id of ["platforms", "services", "delivery", "work", "contact"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });

  test("platform tabs swap the fintech playbook content", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const panel = page.locator("#platform-panel");
    await expect(panel).toContainText("wallets");

    // Switching lanes updates the panel (driven by script.js).
    await page.getByRole("tab", { name: "SaaS" }).click();
    await expect(panel).toContainText(/subscription|SaaS/i);
  });

  test("contact form submits successfully against the live API", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const form = page.locator("[data-contact-form]");

    await form.locator('[name="name"]').fill("E2E Tester");
    await form.locator('[name="email"]').fill("e2e@example.com");
    await form.locator('[name="service"]').selectOption({ index: 1 });
    await form
      .locator('[name="message"]')
      .fill("This is an automated end-to-end test submission for the contact form.");

    await form.getByRole("button", { name: /send inquiry/i }).click();

    // The status line reflects the server's success response.
    await expect(page.locator("[data-form-status]")).toContainText(/received|thanks/i, {
      timeout: 10000
    });
  });

  test("the DropOff case-study video is present and playable", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const video = page.locator("video").first();
    await expect(video).toHaveCount(1);
    // The source resolves (206/200) — readyState advances past HAVE_NOTHING.
    await expect
      .poll(async () => video.evaluate((v) => v.readyState), { timeout: 10000 })
      .toBeGreaterThan(0);
  });
});
