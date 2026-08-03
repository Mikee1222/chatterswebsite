import { defineConfig, devices } from "@playwright/test";
import { loadE2EEnv } from "./e2e/helpers/load-env";

loadE2EEnv();

const baseURL =
  process.env.E2E_BASE_URL?.trim() ||
  process.env.PLAYWRIGHT_BASE_URL?.trim() ||
  "http://127.0.0.1:3000";

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/e2e-results.json" }],
  ],
  outputDir: "test-results/artifacts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 45_000,
    navigationTimeout: 90_000,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: bypass
      ? {
          "x-vercel-protection-bypass": bypass,
          "x-vercel-set-bypass-cookie": "true",
        }
      : undefined,
    ...devices["Desktop Chrome"],
  },
  projects: [
    { name: "admin", testMatch: /roles\/admin\.|flows\/admin\./ },
    { name: "chatter", testMatch: /roles\/chatter\.|flows\/chatter\./ },
    { name: "va", testMatch: /roles\/va\.|flows\/va\./ },
    { name: "model", testMatch: /roles\/model\.|flows\/model\./ },
    { name: "smoke", testMatch: /smoke\./ },
  ],
});
