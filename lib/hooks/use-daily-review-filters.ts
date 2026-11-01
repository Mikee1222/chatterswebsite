"use client";

import * as React from "react";
import {
  applyDailyReviewPreset,
  dailyReviewFiltersToQueryString,
  emptyDailyReviewFilters,
  parseDailyReviewFilters,
  readStoredDailyReviewFilters,
  writeStoredDailyReviewFilters,
  type DailyReviewFilters,
} from "@/lib/daily-review-filters";

function filtersEqual(a: DailyReviewFilters, b: DailyReviewFilters): boolean {
  return dailyReviewFiltersToQueryString(a) === dailyReviewFiltersToQueryString(b);
}

/**
 * Daily Review filter state: URL query params (shareable) + localStorage per scope.
 * URL wins on first paint when present; otherwise restore stored prefs.
 */
export function useDailyReviewFilters(
  scope: "submit" | "manage",
  initialFilters?: DailyReviewFilters | null,
) {
  const [filters, setFiltersState] = React.useState<DailyReviewFilters>(() => {
    if (initialFilters) return applyDailyReviewPreset(initialFilters);
    if (typeof window !== "undefined") {
      const fromUrl = parseDailyReviewFilters(new URLSearchParams(window.location.search));
      const urlHas =
        window.location.search.includes("roles=") ||
        window.location.search.includes("people=") ||
        window.location.search.includes("models=") ||
        window.location.search.includes("review_status=") ||
        window.location.search.includes("task_state=") ||
        window.location.search.includes("phases=") ||
        window.location.search.includes("platforms=") ||
        window.location.search.includes("item_types=") ||
        window.location.search.includes("evidence=") ||
        window.location.search.includes("q=") ||
        window.location.search.includes("sort=") ||
        window.location.search.includes("preset=");
      if (urlHas) return fromUrl;
      return readStoredDailyReviewFilters(scope) ?? emptyDailyReviewFilters();
    }
    return emptyDailyReviewFilters();
  });

  const skipUrlWrite = React.useRef(true);

  React.useEffect(() => {
    writeStoredDailyReviewFilters(scope, filters);
    if (skipUrlWrite.current) {
      skipUrlWrite.current = false;
      return;
    }
    try {
      const url = new URL(window.location.href);
      const date = url.searchParams.get("date");
      const next = new URLSearchParams(dailyReviewFiltersToQueryString(filters));
      if (date) next.set("date", date);
      // Preserve unrelated params except our filter keys / date handled above.
      const qs = next.toString();
      const path = `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
      window.history.replaceState(null, "", path);
    } catch {
      // ignore
    }
  }, [filters, scope]);

  const setFilters = React.useCallback((next: DailyReviewFilters | ((prev: DailyReviewFilters) => DailyReviewFilters)) => {
    setFiltersState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      const normalized = applyDailyReviewPreset(resolved);
      return filtersEqual(prev, normalized) ? prev : normalized;
    });
  }, []);

  return { filters, setFilters };
}
