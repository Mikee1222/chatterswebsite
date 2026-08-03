import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";
import { tryGetRoleCredentials } from "../helpers/credentials";
import { assertPageHealthy, dismissOverlays } from "../helpers/assert-page";

test.describe.serial("VA interactive flows", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    const creds = tryGetRoleCredentials("virtual_assistant");
    test.skip(!creds, "Missing E2E_VA_* credentials");
    await loginAs(page, creds!);
    await dismissOverlays(page);
  });

  test("My Tasks (VA tasks) loads", async ({ page }) => {
    await page.goto("/va-tasks", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    expect(new URL(page.url()).pathname).toBe("/va-tasks");
    await assertPageHealthy(page, "va tasks");
    await expect(page.locator("body")).toContainText(/task/i);
  });

  test("complete checklist item if available", async ({ page }) => {
    await page.goto("/va-tasks", { waitUntil: "domcontentloaded" });
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
    await page.goto("/winners", { waitUntil: "domcontentloaded" });
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
    await page.goto("/va/marketing", { waitUntil: "domcontentloaded" });
    await assertPageHealthy(page, "va marketing");
  });
});
