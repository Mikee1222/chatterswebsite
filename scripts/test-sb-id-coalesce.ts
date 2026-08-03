/**
 * Offline simulation: 1000+ parallel sbAirtableIdsForUuids calls must coalesce
 * into a handful of chunked IN queries (no live DNS / EBUSY).
 *
 * Run: npx tsx scripts/test-sb-id-coalesce.ts
 */
import {
  __resetSbIdLookupStats,
  __sbIdLookupQueryCount,
  __setSbIdLookupFetchForTests,
  sbAirtableIdsForUuids,
  sbUuidsForAirtableIds,
} from "../lib/supabase-data";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const N = 1200;
  const uuids = Array.from({ length: N }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

  __setSbIdLookupFetchForTests(async (_table, column, values) => {
    // Simulate network work without DNS
    await new Promise((r) => setTimeout(r, 1));
    return values.map((v) =>
      column === "id"
        ? { id: v, airtable_id: `rec${v.slice(-10)}` }
        : { id: `uuid-for-${v}`, airtable_id: v }
    );
  });

  // --- Case 1: N+1 parallel single-id lookups (the shifts bug pattern) ---
  __resetSbIdLookupStats();
  const parallel = await Promise.all(uuids.map((id) => sbAirtableIdsForUuids("shifts", [id])));
  assert(parallel.length === N, "parallel length");
  assert(parallel[0]![0]?.startsWith("rec"), "mapped airtable id");
  const parallelQueries = __sbIdLookupQueryCount;
  // 1200 ids / chunk 80 = 15 chunks; concurrency 3 still 15 queries total (not 1200)
  assert(parallelQueries <= 20, `expected ≤20 queries for coalesced N+1, got ${parallelQueries}`);
  console.log(`✓ 1200 parallel single-id lookups → ${parallelQueries} queries (not ${N})`);

  // --- Case 2: one large batch ---
  __resetSbIdLookupStats();
  const batch = await sbAirtableIdsForUuids("shifts", uuids);
  assert(batch.length === N, "batch length");
  const batchQueries = __sbIdLookupQueryCount;
  assert(batchQueries === Math.ceil(N / 80), `expected ${Math.ceil(N / 80)} chunks, got ${batchQueries}`);
  console.log(`✓ single 1200-id batch → ${batchQueries} chunked queries`);

  // --- Case 3: reverse mapper coalesce ---
  __resetSbIdLookupStats();
  const recs = uuids.map((_, i) => `rec${String(i).padStart(14, "0")}`);
  await Promise.all(recs.map((id) => sbUuidsForAirtableIds("users", [id])));
  const reverseQueries = __sbIdLookupQueryCount;
  assert(reverseQueries <= 20, `expected ≤20 reverse queries, got ${reverseQueries}`);
  console.log(`✓ 1200 parallel rec→uuid lookups → ${reverseQueries} queries`);

  __setSbIdLookupFetchForTests(null);
  console.log("All coalesce simulations passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
