import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import type {
  CreatorsComparisonDays,
  CreatorsComparisonMarketFilter,
  CreatorsComparisonSortKey,
} from "@/lib/creators-comparison";
import { listCreatorsComparison } from "@/services/cross-platform-analytics";

const SORT_KEYS = new Set<CreatorsComparisonSortKey>([
  "modelName",
  "views",
  "reach",
  "newSubs",
  "subsPer100kViews",
  "viewsDeltaPct",
  "subsDeltaPct",
]);

/**
 * GET /api/admin/creators-comparison?days=7|30&market=all|GR|USA
 * Batch IG (ClarioSuite) × OF (Infloww) comparison — one row per creator.
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const daysRaw = url.searchParams.get("days");
  const days: CreatorsComparisonDays = daysRaw === "30" ? 30 : 7;
  const marketRaw = url.searchParams.get("market");
  const market: CreatorsComparisonMarketFilter =
    marketRaw === "GR" || marketRaw === "USA" ? marketRaw : "all";
  const sortKeyRaw = url.searchParams.get("sort") ?? "views";
  const sortKey: CreatorsComparisonSortKey = SORT_KEYS.has(sortKeyRaw as CreatorsComparisonSortKey)
    ? (sortKeyRaw as CreatorsComparisonSortKey)
    : "views";
  const sortDir = url.searchParams.get("dir") === "asc" ? "asc" : "desc";

  try {
    const result = await listCreatorsComparison({ days, market, sortKey, sortDir });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("[creators-comparison]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load comparison" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
