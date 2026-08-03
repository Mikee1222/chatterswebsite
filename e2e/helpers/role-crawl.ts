import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";
import { tryGetRoleCredentials } from "../helpers/credentials";
import {
  assertPageHealthy,
  collectSidebarHrefs,
  crawlHref,
  dismissOverlays,
  FALLBACK_HREFS,
  type CrawlResult,
} from "../helpers/assert-page";
import type { E2ERole } from "../helpers/credentials";

function roleCrawl(role: E2ERole, homePath: string) {
  test.describe.serial(`${role} nav crawl`, () => {
    // Large admin nav can take several minutes on cold preview.
    test(`login + crawl every nav page (${role})`, async ({ page }, testInfo) => {
      test.setTimeout(900_000);
      const creds = tryGetRoleCredentials(role);
      test.skip(!creds, `Missing E2E credentials for ${role}`);

      await loginAs(page, creds!);
      await assertPageHealthy(page, `${role} post-login`);
      await dismissOverlays(page);

      await page.goto(homePath, { waitUntil: "domcontentloaded" });
      await assertPageHealthy(page, `${role} home`);
      await dismissOverlays(page);

      let hrefs = await collectSidebarHrefs(page);
      if (hrefs.length === 0) {
        hrefs = FALLBACK_HREFS[role] ?? [homePath];
        console.warn(`[e2e] ${role}: sidebar empty — using ${hrefs.length} fallback hrefs`);
      } else {
        console.log(`[e2e] ${role}: crawling ${hrefs.length} sidebar hrefs`);
      }

      const results: CrawlResult[] = [];
      for (const href of hrefs) {
        const result = await crawlHref(page, href);
        results.push(result);
        const line = `${result.ok ? "PASS" : "FAIL"} ${href} → ${result.finalUrl}${
          result.detail ? ` (${result.detail})` : ""
        }`;
        console.log(`[e2e][${role}] ${line}`);
        await testInfo.attach(`crawl-${role}-${href.replace(/\W+/g, "_")}`, {
          body: line,
          contentType: "text/plain",
        });
      }

      const failures = results.filter((r) => !r.ok);
      await testInfo.attach(`${role}-crawl-summary.json`, {
        body: JSON.stringify(
          { role, total: results.length, failures: failures.length, results },
          null,
          2
        ),
        contentType: "application/json",
      });

      expect(
        failures,
        failures.map((f) => `${f.href}: ${f.detail}`).join("\n")
      ).toEqual([]);
    });
  });
}

export { roleCrawl };
