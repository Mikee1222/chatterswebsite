/** Client fetch options for task phase APIs — always bypass HTTP cache (PWA/mobile Safari). */
export const VA_TASK_PHASES_FETCH_INIT: RequestInit = {
  credentials: "include",
  cache: "no-store",
};

/** JSON response headers for task phase API routes. */
export const VA_TASK_PHASES_JSON_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;
