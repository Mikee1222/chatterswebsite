/**
 * Clean clearly-labeled E2E/smoke test rows from Supabase Production.
 *
 * Dry-run (default):
 *   npx tsx scripts/cleanup-supabase-e2e-smoke-data.ts
 *
 * Apply deletes:
 *   npx tsx scripts/cleanup-supabase-e2e-smoke-data.ts --execute
 *
 * Safety:
 * - Does NOT delete user accounts (e2e-*@gunzo.e2e or test@gmail.com)
 * - Does NOT touch Airtable
 * - Only deletes rows matching explicit smoke / E2E / [TEST] criteria
 *
 * Note: Production cleanup for 2026-08-04 was also applied via Supabase SQL
 * (see docs/supabase-migration/TEST_DATA_CLEANUP.md). This script is for re-runs.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

const EXECUTE = process.argv.includes("--execute");

type FilterFn = (q: {
  eq: (col: string, val: string) => unknown;
  in: (col: string, vals: string[]) => unknown;
  ilike: (col: string, pattern: string) => unknown;
}) => unknown;

async function main() {
  const { getSupabaseServiceClient } = await import("../lib/supabase-server");
  const sb = getSupabaseServiceClient();

  const { data: e2eUsers, error: e2eErr } = await sb
    .from("users")
    .select("id, email")
    .ilike("email", "%@gunzo.e2e");
  if (e2eErr) throw e2eErr;
  const e2eIds = (e2eUsers ?? []).map((u) => String(u.id));

  console.log(`Mode: ${EXECUTE ? "EXECUTE" : "DRY-RUN"}`);
  console.log(`E2E users kept: ${(e2eUsers ?? []).map((u) => u.email).join(", ") || "(none)"}`);

  async function countFiltered(table: string, apply: FilterFn): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = sb.from(table).select("*", { count: "exact", head: true });
    q = apply(q);
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  }

  async function deleteFiltered(table: string, apply: FilterFn): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = sb.from(table).delete().select("id");
    q = apply(q);
    const { data, error } = await q;
    if (error) throw error;
    return data?.length ?? 0;
  }

  async function run(table: string, description: string, apply: FilterFn): Promise<number> {
    const n = EXECUTE ? await deleteFiltered(table, apply) : await countFiltered(table, apply);
    console.log(`${EXECUTE ? "deleted" : "would_delete"} ${String(n).padStart(4)}  ${table} — ${description}`);
    return n;
  }

  const { data: smokeIdeas } = await sb
    .from("research_ideas")
    .select("id, bunch_id")
    .ilike("idea_text", "smoke idea");
  const bunchIds = [...new Set((smokeIdeas ?? []).map((r) => String(r.bunch_id)).filter(Boolean))];

  const { data: smokeContent } = await sb
    .from("content_items")
    .select("id, item_id")
    .ilike("title", "smoke idea");
  const contentItemIds = [
    ...new Set(
      (smokeContent ?? [])
        .flatMap((r) => [String(r.item_id || ""), String(r.id)])
        .filter(Boolean)
    ),
  ];

  const { data: recentShifts } = await sb
    .from("shifts")
    .select("id, notes, chatter_name")
    .is("airtable_id", null)
    .gte("created_at", "2026-08-03");
  const shiftIds = (recentShifts ?? [])
    .filter((s) => {
      const notes = String(s.notes ?? "");
      const name = String(s.chatter_name ?? "");
      return notes.includes("smoke-supabase") || name === "test" || name === "Testing Member";
    })
    .map((s) => String(s.id));

  let grand = 0;

  if (contentItemIds.length) {
    grand += await run("content_item_events", "events for smoke idea content", (q) =>
      q.in("item_id", contentItemIds)
    );
  } else {
    console.log(`${EXECUTE ? "deleted" : "would_delete"}    0  content_item_events — (none)`);
  }

  grand += await run("content_items", "title ILIKE smoke idea", (q) => q.ilike("title", "smoke idea"));
  grand += await run("research_ideas", "idea_text ILIKE smoke idea", (q) =>
    q.ilike("idea_text", "smoke idea")
  );

  if (bunchIds.length) {
    grand += await run("research_bunches", "bunches that spawned smoke ideas", (q) =>
      q.in("id", bunchIds)
    );
  } else {
    console.log(`${EXECUTE ? "deleted" : "would_delete"}    0  research_bunches — (none)`);
  }

  // Sequential notification deletes (OR across filters)
  grand += await run("notifications", "body smoke-supabase", (q) =>
    q.ilike("body", "%smoke-supabase%")
  );
  grand += await run("notifications", "title Smoke %", (q) => q.ilike("title", "Smoke %"));
  grand += await run("notifications", "title test started", (q) =>
    q.ilike("title", "%test started%")
  );
  grand += await run("notifications", "title test ended", (q) => q.ilike("title", "%test ended%"));
  if (e2eIds.length) {
    grand += await run("notifications", "E2E user inboxes", (q) => q.in("user_id", e2eIds));
  }

  if (shiftIds.length) {
    grand += await run("points_transactions", "points for test smoke shifts", (q) =>
      q.in("reference_id", shiftIds)
    );
  } else {
    console.log(`${EXECUTE ? "deleted" : "would_delete"}    0  points_transactions — (none)`);
  }

  grand += await run("payment_submissions", "note ILIKE %smoke%", (q) => q.ilike("note", "%smoke%"));
  grand += await run("marketing_spot_checks", "what_was_wrong smoke", (q) =>
    q.ilike("what_was_wrong", "%smoke-supabase%")
  );
  grand += await run("marketing_daily_reviews", "issues_found smoke", (q) =>
    q.ilike("issues_found", "%smoke-supabase%")
  );
  grand += await run("link_page_analytics", "user_agent smoke", (q) =>
    q.ilike("user_agent", "%smoke-supabase%")
  );
  grand += await run("winner_videos", "note smoke-supabase", (q) =>
    q.ilike("note", "%smoke-supabase%")
  );
  grand += await run("custom_requests", "Smoke custom title", (q) =>
    q.ilike("request_title", "%Smoke custom%")
  );
  grand += await run("custom_requests", "Debug approve title", (q) =>
    q.ilike("request_title", "%Debug approve%")
  );
  grand += await run("custom_requests", "fan smoke_fan_local", (q) =>
    q.eq("fan_username", "smoke_fan_local")
  );

  if (shiftIds.length) {
    grand += await run("shifts", "smoke/test native shifts", (q) => q.in("id", shiftIds));
  } else {
    console.log(`${EXECUTE ? "deleted" : "would_delete"}    0  shifts — (none)`);
  }

  grand += await run("va_tasks", "title [TEST]", (q) => q.ilike("title", "%[TEST]%"));

  console.log(`\nTotal ${EXECUTE ? "deleted" : "would delete"}: ${grand}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
