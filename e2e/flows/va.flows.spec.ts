import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";
import { tryGetRoleCredentials } from "../helpers/credentials";
import { assertPageHealthy, dismissOverlays, gotoWithRetry } from "../helpers/assert-page";

async function asVa(page: import("@playwright/test").Page) {
  const creds = tryGetRoleCredentials("virtual_assistant");
  test.skip(!creds, "Missing E2E_VA_* credentials");
  await loginAs(page, creds!);
  await dismissOverlays(page);
}

test.describe("VA interactive flows", () => {
  test("My Tasks (VA tasks) loads", async ({ page }) => {
    test.setTimeout(180_000);
    await asVa(page);
    await gotoWithRetry(page, "/va-tasks");
    await page.waitForTimeout(1000);
    expect(new URL(page.url()).pathname).toBe("/va-tasks");
    await assertPageHealthy(page, "va tasks");
    await expect(page.locator("body")).toContainText(/task/i);
  });

  test("complete checklist item if available", async ({ page }) => {
    test.setTimeout(180_000);
    await asVa(page);
    await gotoWithRetry(page, "/va-tasks");
    await assertPageHealthy(page, "va tasks");
    const checkbox = page.getByRole("checkbox").first();
    if (!(await checkbox.isVisible().catch(() => false))) {
      test.skip(true, "No checklist checkbox available for E2E VA");
    }
    await checkbox.click({ force: true });
    await page.waitForTimeout(1000);
    await assertPageHealthy(page, "after checklist toggle");
  });

  test("Winner / Research submit page (if permitted)", async ({ page }) => {
    test.setTimeout(180_000);
    await asVa(page);
    await gotoWithRetry(page, "/winners");
    await page.waitForTimeout(1000);
    const path = new URL(page.url()).pathname;
    if (path === "/winners") {
      await assertPageHealthy(page, "winners");
    } else {
      test.info().annotations.push({
        type: "note",
        description: `VA redirected from /winners to ${path} (permission likely missing)`,
      });
    }
  });

  test("Marketing page loads", async ({ page }) => {
    test.setTimeout(180_000);
    await asVa(page);
    await gotoWithRetry(page, "/va/marketing");
    await assertPageHealthy(page, "va marketing");
  });
});
