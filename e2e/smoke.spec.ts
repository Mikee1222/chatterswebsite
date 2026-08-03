import { test, expect } from "@playwright/test";
import { loadE2EEnv } from "./helpers/load-env";

loadE2EEnv();

test.describe("preview smoke", () => {
  test("login page reachable (bypass works)", async ({ page }) => {
    const res = await page.goto("/login", { waitUntil: "domcontentloaded" });
    expect(res?.status(), "login HTTP status").toBeLessThan(400);
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible({ timeout: 60_000 });
    // Must not be stuck on Vercel SSO
    expect(page.url()).not.toMatch(/vercel\.com\/sso/);
  });
});
