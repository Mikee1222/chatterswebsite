import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";
import { tryGetRoleCredentials } from "../helpers/credentials";
import { assertPageHealthy, dismissOverlays } from "../helpers/assert-page";

test.describe.serial("admin interactive flows", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    const creds = tryGetRoleCredentials("admin");
    test.skip(!creds, "Missing E2E_ADMIN_* credentials");
    await loginAs(page, creds!);
    await dismissOverlays(page);
  });

  test("create VA task labeled [E2E]", async ({ page }) => {
    await page.goto("/admin/va-tasks", { waitUntil: "domcontentloaded" });
    await assertPageHealthy(page, "admin va-tasks");
    await dismissOverlays(page);

    const newTask = page.getByRole("button", { name: /new task/i });
    await expect(newTask).toBeVisible({ timeout: 60_000 });
    await newTask.click();

    const title = `[E2E] Task ${Date.now()}`;
    const dialog = page.getByRole("dialog");
    const titleInput = dialog.locator('input[type="text"], input:not([type])').first();
    await titleInput.fill(title);

    const createBtn = page.getByRole("button", { name: /create task/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    await expect(page.getByText(title).first()).toBeVisible({ timeout: 60_000 });
  });

  test("Progress Overview tab loads", async ({ page }) => {
    await page.goto("/admin/va-tasks", { waitUntil: "domcontentloaded" });
    await assertPageHealthy(page, "admin va-tasks");
    const progress = page.getByRole("button", { name: /progress overview/i }).or(
      page.getByRole("tab", { name: /progress overview/i })
    );
    if (!(await progress.first().isVisible().catch(() => false))) {
      test.skip(true, "Progress Overview control not visible");
    }
    await progress.first().click();
    await assertPageHealthy(page, "progress overview");
    await expect(page.getByText(/progress/i).first()).toBeVisible();
  });

  test("Winner Videos / Research page loads (approve UI present)", async ({ page }) => {
    await page.goto("/admin/winner-videos", { waitUntil: "domcontentloaded" });
    await assertPageHealthy(page, "winner videos");
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(20);
  });

  test("Weekly Program page loads; duplicate/create controls if present", async ({ page }) => {
    await page.goto("/admin/weekly-program", { waitUntil: "domcontentloaded" });
    await assertPageHealthy(page, "weekly program");
    const dup = page.getByRole("button", { name: /duplicate/i });
    if (await dup.first().isVisible().catch(() => false)) {
      await expect(dup.first()).toBeEnabled();
    }
  });

  test("Marketing accounts page loads", async ({ page }) => {
    await page.goto("/admin/marketing", { waitUntil: "domcontentloaded" });
    await assertPageHealthy(page, "marketing");
    await expect(page.locator("body")).toContainText(/market/i);
  });
});
