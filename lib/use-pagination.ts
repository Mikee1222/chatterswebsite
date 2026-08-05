import { useState, useMemo, useCallback } from "react";

export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  // Stable identity so filter effects that depend on `reset` do not
  // re-fire on every render and snap the user back to page 1.
  const reset = useCallback(() => setPage(1), []);

  return { page: safePage, setPage, totalPages, paginated, reset };
}
