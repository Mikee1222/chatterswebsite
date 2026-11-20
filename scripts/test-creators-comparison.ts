/**
 * Pure-function checks for Creators comparison helpers.
 *   npx tsx scripts/test-creators-comparison.ts
 */

import {
  buildCreatorsComparisonRow,
  completeDaysRangeEndingYesterday,
  deltaPct,
  mapSocialRegionToMarket,
  marketsFromRegions,
  rowMatchesMarket,
  sortCreatorsComparisonRows,
  subsPer100kViews,
  type CreatorsComparisonRow,
} from "../lib/creators-comparison";

let failed = 0;

function assert(name: string, ok: boolean) {
  console.log(`${name}: ${ok ? "PASS" : "FAIL"}`);
  if (!ok) failed += 1;
}

function approx(a: number | null, b: number | null, eps = 0.01): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= eps;
}

// --- subs per 100k ---
assert("subs/100k basic", approx(subsPer100kViews(5, 100_000), 5));
assert("subs/100k views=0 → null", subsPer100kViews(5, 0) === null);
assert("subs/100k missing views → null", subsPer100kViews(5, null) === null);
assert("subs/100k missing subs → null", subsPer100kViews(null, 100_000) === null);

// --- delta previous=0 ---
assert("delta prev=0 → null", deltaPct(10, 0) === null);
assert("delta prev null → null", deltaPct(10, null) === null);
assert("delta current null → null", deltaPct(null, 10) === null);
assert("delta +100%", approx(deltaPct(200, 100), 100));
assert("delta -50%", approx(deltaPct(50, 100), -50));

// --- market Greek → GR ---
assert("Greek → GR", mapSocialRegionToMarket("Greek") === "GR");
assert("Greece → GR", mapSocialRegionToMarket("Greece") === "GR");
assert("USA → USA", mapSocialRegionToMarket("USA") === "USA");
assert("Global → null", mapSocialRegionToMarket("Global") === null);
assert(
  "marketsFromRegions both",
  marketsFromRegions(["Greek", "USA", "Global"]).join(",") === "GR,USA"
);
assert("rowMatchesMarket GR", rowMatchesMarket(["GR", "USA"], "GR") === true);
assert("rowMatchesMarket USA only on GR filter", rowMatchesMarket(["USA"], "GR") === false);
assert("rowMatchesMarket empty on All", rowMatchesMarket([], "all") === true);
assert("rowMatchesMarket empty on GR", rowMatchesMarket([], "GR") === false);

// --- missing-side rows ---
const both = buildCreatorsComparisonRow({
  modelRecordId: "a",
  modelName: "Alpha",
  market: ["GR"],
  hasIg: true,
  hasOf: true,
  views: 1000,
  reach: 800,
  newSubs: 2,
  prevViews: 500,
  prevNewSubs: 1,
});
assert("both status ready", both.status === "ready");
assert("both has views", both.views === 1000);
assert("both subs/100k set", both.subsPer100kViews != null);

const igOnly = buildCreatorsComparisonRow({
  modelRecordId: "b",
  modelName: "Beta",
  market: [],
  hasIg: true,
  hasOf: false,
  views: 5000,
  reach: 4000,
  newSubs: 0,
  prevViews: 0,
  prevNewSubs: 0,
});
assert("ig_only status", igOnly.status === "ig_only");
assert("ig_only newSubs null (not 0)", igOnly.newSubs === null);
assert("ig_only subs/100k null", igOnly.subsPer100kViews === null);
assert("ig_only viewsDelta prev0 null", igOnly.viewsDeltaPct === null);

const ofOnly = buildCreatorsComparisonRow({
  modelRecordId: "c",
  modelName: "Gamma",
  market: ["USA"],
  hasIg: false,
  hasOf: true,
  views: 0,
  reach: 0,
  newSubs: 3,
  prevViews: 0,
  prevNewSubs: 0,
});
assert("of_only status", ofOnly.status === "of_only");
assert("of_only views null (not 0)", ofOnly.views === null);
assert("of_only reach null", ofOnly.reach === null);

const unlinked = buildCreatorsComparisonRow({
  modelRecordId: "d",
  modelName: "Delta",
  market: [],
  hasIg: false,
  hasOf: false,
  views: 0,
  reach: 0,
  newSubs: 0,
  prevViews: 0,
  prevNewSubs: 0,
});
assert("unlinked status", unlinked.status === "unlinked");

// --- sort: nulls last + missing-side bottom ---
const lowViewsBoth = buildCreatorsComparisonRow({
  modelRecordId: "e",
  modelName: "Epsilon",
  market: ["GR"],
  hasIg: true,
  hasOf: true,
  views: 10,
  reach: 10,
  newSubs: 1,
  prevViews: 10,
  prevNewSubs: 1,
});
const sorted = sortCreatorsComparisonRows(
  [igOnly, both, ofOnly, lowViewsBoth],
  "views",
  "desc"
);
assert("sort missing-side last", sorted[0]!.modelRecordId === "a" && sorted[1]!.modelRecordId === "e");
assert(
  "sort complete before missing",
  !["b", "c"].includes(sorted[0]!.modelRecordId) &&
    !["b", "c"].includes(sorted[1]!.modelRecordId)
);

const withNullViews: CreatorsComparisonRow[] = [
  { ...both, modelRecordId: "n1", modelName: "N1", views: null, status: "ready" },
  { ...both, modelRecordId: "n2", modelName: "N2", views: 50, status: "ready" },
  { ...both, modelRecordId: "n3", modelName: "N3", views: 100, status: "ready" },
];
const nullsLast = sortCreatorsComparisonRows(withNullViews, "views", "desc");
assert("nulls last on views desc", nullsLast[2]!.views === null && nullsLast[0]!.views === 100);

// --- period range ---
const addDays = (ymd: string, delta: number) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
};
const range7 = completeDaysRangeEndingYesterday(7, "2026-11-19", addDays);
assert("7d end = yesterday", range7.endYmd === "2026-11-19");
assert("7d start", range7.startYmd === "2026-11-13");
const range30 = completeDaysRangeEndingYesterday(30, "2026-11-19", addDays);
assert("30d start", range30.startYmd === "2026-10-21");

if (failed > 0) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log("\nAll creators-comparison checks passed.");
