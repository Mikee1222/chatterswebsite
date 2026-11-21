/**
 * Pure helpers for Creators comparison (IG vs OF).
 * Used by the batch loader, API, UI, and unit script.
 */

export type CreatorsComparisonMarket = "GR" | "USA";
export type CreatorsComparisonMarketFilter = "all" | CreatorsComparisonMarket;
export type CreatorsComparisonDays = 7 | 30;

/** Aligns with CrossPlatformStatus (ig_only / of_only / unlinked / ready / sparse). */
export type CreatorsComparisonStatus =
  | "ready"
  | "sparse"
  | "ig_only"
  | "of_only"
  | "unlinked";

export type CreatorsComparisonSortKey =
  | "modelName"
  | "views"
  | "reach"
  | "newSubs"
  | "subsPer100kViews"
  | "viewsDeltaPct"
  | "subsDeltaPct";

export type CreatorsComparisonRow = {
  modelRecordId: string;
  modelName: string;
  market: CreatorsComparisonMarket[];
  views: number | null;
  reach: number | null;
  newSubs: number | null;
  subsPer100kViews: number | null;
  viewsDeltaPct: number | null;
  subsDeltaPct: number | null;
  status: CreatorsComparisonStatus;
};

/** Map model_social_accounts.region → market code. */
export function mapSocialRegionToMarket(
  region: string | null | undefined
): CreatorsComparisonMarket | null {
  const r = (region ?? "").trim();
  if (r === "Greek" || r === "Greece" || r === "GR") return "GR";
  if (r === "USA") return "USA";
  return null;
}

/** Unique markets from social-account regions (order GR then USA). */
export function marketsFromRegions(regions: Iterable<string | null | undefined>): CreatorsComparisonMarket[] {
  const set = new Set<CreatorsComparisonMarket>();
  for (const region of regions) {
    const m = mapSocialRegionToMarket(region);
    if (m) set.add(m);
  }
  const out: CreatorsComparisonMarket[] = [];
  if (set.has("GR")) out.push("GR");
  if (set.has("USA")) out.push("USA");
  return out;
}

export function rowMatchesMarket(
  markets: CreatorsComparisonMarket[],
  filter: CreatorsComparisonMarketFilter
): boolean {
  if (filter === "all") return true;
  return markets.includes(filter);
}

/** Subs per 100k views — null when views missing/0 or newSubs missing. */
export function subsPer100kViews(
  newSubs: number | null,
  views: number | null
): number | null {
  if (newSubs == null || views == null || views === 0) return null;
  return Math.round((newSubs / views) * 100_000 * 100) / 100;
}

/** % change vs previous; null when previous is 0 or either side is null. */
export function deltaPct(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 10000) / 100;
}

export function comparisonStatus(hasIg: boolean, hasOf: boolean): CreatorsComparisonStatus {
  if (!hasIg && !hasOf) return "unlinked";
  if (!hasIg) return "of_only";
  if (!hasOf) return "ig_only";
  return "ready";
}

export function isMissingSideStatus(status: CreatorsComparisonStatus): boolean {
  return status === "ig_only" || status === "of_only" || status === "unlinked";
}

/** Last N complete Athens days ending on `yesterdayYmd`. */
export function completeDaysRangeEndingYesterday(
  days: CreatorsComparisonDays,
  yesterdayYmd: string,
  addDays: (ymd: string, delta: number) => string
): { startYmd: string; endYmd: string } {
  const endYmd = yesterdayYmd.slice(0, 10);
  const startYmd = addDays(endYmd, -(days - 1));
  return { startYmd, endYmd };
}

function sortNullsLastNumber(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: "asc" | "desc"
): number | null {
  const aNull = a == null || Number.isNaN(a);
  const bNull = b == null || Number.isNaN(b);
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  const cmp = (a as number) - (b as number);
  return dir === "asc" ? cmp : -cmp;
}

function sortValue(row: CreatorsComparisonRow, key: CreatorsComparisonSortKey): number | null {
  if (key === "modelName") return null;
  if (key === "views") return row.views;
  if (key === "reach") return row.reach;
  if (key === "newSubs") return row.newSubs;
  if (key === "subsPer100kViews") return row.subsPer100kViews;
  if (key === "viewsDeltaPct") return row.viewsDeltaPct;
  return row.subsDeltaPct;
}

/**
 * Sort: missing-side rows last, then null metric values last, then by key.
 * Default key Views desc.
 */
export function sortCreatorsComparisonRows(
  rows: CreatorsComparisonRow[],
  key: CreatorsComparisonSortKey = "views",
  dir: "asc" | "desc" = "desc"
): CreatorsComparisonRow[] {
  return [...rows].sort((a, b) => {
    const aMissing = isMissingSideStatus(a.status) ? 1 : 0;
    const bMissing = isMissingSideStatus(b.status) ? 1 : 0;
    if (aMissing !== bMissing) return aMissing - bMissing;

    if (key === "modelName") {
      const cmp = a.modelName.localeCompare(b.modelName, undefined, { sensitivity: "base" });
      return dir === "asc" ? cmp : -cmp;
    }

    const numCmp = sortNullsLastNumber(sortValue(a, key), sortValue(b, key), dir);
    if (numCmp != null && numCmp !== 0) return numCmp;

    return a.modelName.localeCompare(b.modelName, undefined, { sensitivity: "base" });
  });
}

export function buildCreatorsComparisonRow(input: {
  modelRecordId: string;
  modelName: string;
  market: CreatorsComparisonMarket[];
  hasIg: boolean;
  hasOf: boolean;
  views: number;
  reach: number;
  newSubs: number;
  prevViews: number;
  prevNewSubs: number;
}): CreatorsComparisonRow {
  const status = comparisonStatus(input.hasIg, input.hasOf);
  const views = input.hasIg ? input.views : null;
  const reach = input.hasIg ? input.reach : null;
  const newSubs = input.hasOf ? input.newSubs : null;
  const both = input.hasIg && input.hasOf;
  return {
    modelRecordId: input.modelRecordId,
    modelName: input.modelName,
    market: input.market,
    views,
    reach,
    newSubs,
    subsPer100kViews: both ? subsPer100kViews(newSubs, views) : null,
    viewsDeltaPct: input.hasIg ? deltaPct(views, input.hasIg ? input.prevViews : null) : null,
    subsDeltaPct: input.hasOf ? deltaPct(newSubs, input.hasOf ? input.prevNewSubs : null) : null,
    status,
  };
}
