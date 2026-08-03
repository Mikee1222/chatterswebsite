import { expect, type Page } from "@playwright/test";

const FATAL_TEXTS = [
  "Something went wrong",
  "Application error: a client-side exception has occurred",
];

export type CrawlResult = {
  href: string;
  ok: boolean;
  finalUrl: string;
  detail?: string;
};

/** Assert the current page rendered without a fatal error boundary. */
export async function assertPageHealthy(page: Page, label: string): Promise<void> {
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(250);

  const body = page.locator("body");
  await expect(body, `${label}: body missing`).toBeVisible({ timeout: 30_000 });

  for (const text of FATAL_TEXTS) {
    const hit = page.getByRole("heading", { name: text, exact: false });
    const visible = await hit.first().isVisible().catch(() => false);
    if (visible) {
      throw new Error(`${label}: fatal UI text visible — "${text}" at ${page.url()}`);
    }
  }
}

async function gotoWithRetry(page: Page, href: string, attempts = 2): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await page.goto(href, { waitUntil: "domcontentloaded", timeout: 60_000 });
      return;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Interrupted navigations are common after auth redirects / soft navigations.
      if (/ERR_ABORTED|frame was detached|Target page.*closed/i.test(msg) && i < attempts - 1) {
        await page.waitForTimeout(500);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Navigate to href and assert healthy.
 * Unexpected bounce to /dashboard (when href is not dashboard/home) counts as failure.
 */
export async function crawlHref(page: Page, href: string): Promise<CrawlResult> {
  const started = href;
  try {
    await gotoWithRetry(page, href);
    await assertPageHealthy(page, href);

    const finalPath = new URL(page.url()).pathname;
    const allowedDashboard =
      href === "/dashboard" || href === "/" || href.startsWith("/login");
    if (!allowedDashboard && finalPath === "/dashboard" && href !== "/dashboard") {
      return {
        href: started,
        ok: false,
        finalUrl: page.url(),
        detail: `unexpected redirect to /dashboard from ${href}`,
      };
    }

    return { href: started, ok: true, finalUrl: page.url() };
  } catch (err) {
    return {
      href: started,
      ok: false,
      finalUrl: page.url(),
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Collect unique in-app nav hrefs from the desktop sidebar (including collapsed sections). */
export async function collectSidebarHrefs(page: Page): Promise<string[]> {
  const sectionButtons = page.locator("aside nav button");
  const count = await sectionButtons.count();
  for (let i = 0; i < count; i++) {
    const btn = sectionButtons.nth(i);
    const expanded = await btn.getAttribute("aria-expanded").catch(() => null);
    if (expanded === "false") {
      await btn.click().catch(() => undefined);
    }
  }
  await page.waitForTimeout(300);

  const hrefs = await page.locator('aside a[href^="/"]').evaluateAll((els) =>
    els
      .map((el) => (el as HTMLAnchorElement).getAttribute("href") || "")
      .filter((h) => h.startsWith("/") && !h.startsWith("//"))
      .map((h) => h.split("?")[0]!.split("#")[0]!)
  );
  return [...new Set(hrefs)].sort();
}

/** Dismiss common blocking overlays. */
export async function dismissOverlays(page: Page): Promise<void> {
  const notNow = page.getByRole("button", { name: /not now/i });
  if (await notNow.isVisible().catch(() => false)) {
    await notNow.click().catch(() => undefined);
  }
}

/** Fallback hrefs when sidebar scrape is empty (e.g. mobile layout). */
export const FALLBACK_HREFS: Record<string, string[]> = {
  admin: [
    "/admin",
    "/admin/va-tasks",
    "/admin/weekly-program",
    "/admin/weekly-program-va",
    "/admin/marketing",
    "/admin/winner-videos",
    "/admin/live-shifts",
    "/admin/models",
    "/admin/accounts",
    "/settings",
  ],
  chatter: [
    "/home",
    "/weekly-program",
    "/shift",
    "/my-whales",
    "/my-rebills",
    "/request-custom",
    "/log-transaction",
    "/rewards",
    "/settings",
  ],
  virtual_assistant: [
    "/va-home",
    "/va-tasks",
    "/va/schedule",
    "/va/marketing",
    "/va/content-assignments",
    "/winners",
    "/settings",
  ],
  model: [
    "/model",
    "/model/schedule",
    "/model/content-calendar",
    "/model/content-assignments",
    "/model/custom-requests",
    "/settings",
  ],
};
