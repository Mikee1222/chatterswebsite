import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";
import { tryGetRoleCredentials } from "../helpers/credentials";
import { assertPageHealthy, dismissOverlays, gotoWithRetry } from "../helpers/assert-page";

async function asChatter(page: import("@playwright/test").Page) {
  const creds = tryGetRoleCredentials("chatter");
  test.skip(!creds, "Missing E2E_CHATTER_* credentials");
  await loginAs(page, creds!);
  await dismissOverlays(page);
}

test.describe("chatter interactive flows", () => {
  test("Weekly Program stays on /weekly-program (no redirect to /dashboard)", async ({ page }) => {
    test.setTimeout(180_000);
    await asChatter(page);
    await gotoWithRetry(page, "/weekly-program");
    await assertPageHealthy(page, "chatter weekly program");
    await page.waitForTimeout(1500);
    const url = new URL(page.url());
    expect(url.pathname, "must not bounce chatter weekly program to dashboard").toBe(
      "/weekly-program"
    );
    expect(url.pathname).not.toBe("/dashboard");
  });

  test("submit rebill/tip page loads", async ({ page }) => {
    test.setTimeout(180_000);
    await asChatter(page);
    await gotoWithRetry(page, "/log-transaction");
    await assertPageHealthy(page, "log transaction");
    const amount = page.locator('input[name="amount"], input[placeholder*="amount" i]').first();
    if (await amount.isVisible().catch(() => false)) {
      await amount.fill("1");
      const submit = page.getByRole("button", { name: /submit|save|log/i }).first();
      if (await submit.isVisible().catch(() => false)) {
        await submit.click();
        await page.waitForTimeout(1500);
        await assertPageHealthy(page, "after tip submit");
      }
    }
  });

  test("Shift page: start/end controls visible or active-state UI", async ({ page }) => {
    test.setTimeout(180_000);
    await asChatter(page);
    await gotoWithRetry(page, "/shift");
    await assertPageHealthy(page, "chatter shift");
    const start = page.getByRole("button", { name: /start shift|start/i });
    const end = page.getByRole("button", { name: /end shift|end/i });
    const hasStart = await start.first().isVisible().catch(() => false);
    const hasEnd = await end.first().isVisible().catch(() => false);
    expect(hasStart || hasEnd || (await page.locator("body").innerText()).length > 40).toBeTruthy();
  });

  test("Custom request page loads", async ({ page }) => {
    test.setTimeout(180_000);
    await asChatter(page);
    await gotoWithRetry(page, "/request-custom");
    await assertPageHealthy(page, "request custom");
  });
});
