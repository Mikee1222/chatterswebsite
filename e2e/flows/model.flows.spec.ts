import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";
import { tryGetRoleCredentials } from "../helpers/credentials";
import { assertPageHealthy, dismissOverlays, gotoWithRetry } from "../helpers/assert-page";

async function asModel(page: import("@playwright/test").Page) {
  const creds = tryGetRoleCredentials("model");
  test.skip(!creds, "Missing E2E_MODEL_* credentials");
  await loginAs(page, creds!);
  await dismissOverlays(page);
}

test.describe("model interactive flows", () => {
  test("schedule / availability loads", async ({ page }) => {
    test.setTimeout(180_000);
    await asModel(page);
    await gotoWithRetry(page, "/model/schedule");
    await assertPageHealthy(page, "model schedule");
  });

  test("content request surfaces if available", async ({ page }) => {
    test.setTimeout(180_000);
    await asModel(page);
    await gotoWithRetry(page, "/model/content-calendar");
    await assertPageHealthy(page, "model content calendar");
    const requestBtn = page.getByRole("button", { name: /request|submit|new/i }).first();
    if (await requestBtn.isVisible().catch(() => false)) {
      await expect(requestBtn).toBeEnabled();
    }
  });

  test("custom requests page loads", async ({ page }) => {
    test.setTimeout(180_000);
    await asModel(page);
    await gotoWithRetry(page, "/model/custom-requests");
    await assertPageHealthy(page, "model customs");
  });
});
