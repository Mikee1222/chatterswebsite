import { expect, type Page } from "@playwright/test";
import type { RoleCredentials } from "./credentials";

const POST_LOGIN_TIMEOUT = 90_000;

/** Log in via the real /login form. Leaves the page on a post-auth route. */
export async function loginAs(page: Page, creds: RoleCredentials): Promise<void> {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible({ timeout: 60_000 });

  await page.locator("#email").fill(creds.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Stay on /login with ?error=… on failure; otherwise leave /login.
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: POST_LOGIN_TIMEOUT,
    }),
    page.waitForURL(/\/login\?error=/, { timeout: POST_LOGIN_TIMEOUT }),
  ]);

  if (page.url().includes("/login")) {
    const errParam = new URL(page.url()).searchParams.get("error");
    const errAlert = page.getByRole("alert");
    const alertText = (await errAlert.textContent().catch(() => null))?.trim();
    throw new Error(
      `Login failed for ${creds.role} (${creds.email}): ${alertText || errParam || "stayed on /login"}`
    );
  }

  // Let post-login redirects (dashboard → role home) settle before the next goto.
  // Avoid networkidle — the app keeps websockets/polling open on Preview.
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(800);

  (page as Page & { __e2eConsoleErrors?: string[] }).__e2eConsoleErrors = consoleErrors;
}

export async function logoutIfPossible(page: Page): Promise<void> {
  try {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
  } catch {
    // ignore
  }
}

export function getConsoleErrors(page: Page): string[] {
  return (page as Page & { __e2eConsoleErrors?: string[] }).__e2eConsoleErrors ?? [];
}
