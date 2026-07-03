/**
 * Schedule async work to continue after the HTTP response is sent.
 *
 * Next.js 14 — `after()` from `next/server` requires Next.js 15+.
 * On Vercel, `@vercel/functions` `waitUntil` extends the invocation when installed.
 * Otherwise falls back to a detached promise (best-effort on other runtimes).
 */
export function runAfterResponse(task: () => Promise<void>): void {
  const work = task().catch((err) => {
    console.error("[runAfterResponse]", err);
  });

  try {
    // Optional peer — present on Vercel deployments that install @vercel/functions.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@vercel/functions") as { waitUntil?: (promise: Promise<unknown>) => void };
    if (typeof mod.waitUntil === "function") {
      mod.waitUntil(work);
      return;
    }
  } catch {
    // @vercel/functions not available — use detached promise below.
  }

  void work;
}
