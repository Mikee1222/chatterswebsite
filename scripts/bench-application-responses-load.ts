/**
 * Benchmark Applications responses list + analytics load path.
 * Usage: npx tsx scripts/bench-application-responses-load.ts [formId]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { listResponses, getFormAnalytics, getApplicationFormById } from "@/services/application-forms";

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  console.log(`${label}: ${ms.toFixed(1)}ms`);
  return result;
}

async function main() {
  const formIdArg = process.argv[2];
  let formId = formIdArg;
  if (!formId) {
    const { getSupabaseServiceClient } = await import("@/lib/supabase-server");
    const sb = getSupabaseServiceClient();
    const { data } = await sb
      .from("application_forms")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      console.error("No application forms found");
      process.exit(1);
    }
    formId = data.id as string;
    console.log(`Using form: ${data.title} (${formId})`);
  }

  console.log("\n--- BEFORE-style path (list + analytics, double fetch) ---");
  const list1 = await time("listResponses (filtered)", () =>
    listResponses(formId!, { status: "all", sort: "newest" }),
  );
  const analytics1 = await time("getFormAnalytics (calls listResponses again)", () =>
    getFormAnalytics(formId!),
  );
  console.log(`  responses: ${list1.length}, analytics total: ${analytics1.total}`);

  console.log("\n--- AFTER-style path (list + lightweight analytics, parallel) ---");
  const { getResponsesListAnalytics } = await import("@/services/application-forms");
  const [list2, analytics2] = await Promise.all([
    time("listResponses (filtered)", () =>
      listResponses(formId!, { status: "all", sort: "newest" }),
    ),
    time("getResponsesListAnalytics (lightweight)", () =>
      getResponsesListAnalytics(formId!),
    ),
  ]);
  console.log(`  responses: ${list2.length}, analytics total: ${analytics2.total}`);

  console.log("\n--- Component breakdown ---");
  await time("getApplicationFormById", () => getApplicationFormById(formId!));
  await time("listResponses only", () => listResponses(formId!, { status: "all", sort: "newest" }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
