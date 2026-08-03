import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";
import { tryGetRoleCredentials } from "../helpers/credentials";
import { assertPageHealthy, dismissOverlays } from "../helpers/assert-page";

test.describe.serial("model interactive flows", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    const creds = tryGetRoleCredentials("model");
    test.skip(!creds, "Missing E2E_MODEL_* credentials");
    await loginAs(page, creds!);
    await dismissOverlays(page);
  });

  test("schedule / availability loads", async ({ page }) => {
    await page.goto("/model/schedule", { waitUntil: "domcontentloaded" });
    await assertPageHealthy(page, "model schedule");
  });

  test("content request surfaces if available", async ({ page }) => {
    await page.goto("/model/content-calendar", { waitUntil: "domcontentloaded" });
    await assertPageHealthy(page, "model content calendar");
    const requestBtn = page.getByRole("button", { name: /request|submit|new/i }).first();
    if (await requestBtn.isVisible().catch(() => false)) {
      await expect(requestBtn).toBeEnabled();
    }
  });

  test("custom requests page loads", async ({ page }) => {
    await page.goto("/model/custom-requests", { waitUntil: "domcontentloaded" });
    await assertPageHealthy(page, "model customs");
  });
});
