/**
 * Fixed allowlist for Hermes agent Bearer tokens (gz_agent_…).
 * DEFAULT DENY: only (method, pathname) pairs matching these rules authenticate.
 * Server-component / page paths never match (API-only).
 */

export type AgentAllowRule = {
  method: "GET" | "POST";
  /** Human-readable pattern for audit logs (e.g. POST /api/posting-briefs/[id]/posts/[postId]/posted). */
  pattern: string;
  /** Test pathname (no query string). */
  test: (pathname: string) => boolean;
};

/** UUID (posting-briefs / posts / supabase row ids). */
const UUID =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
/** Airtable record id (rec + 14 alnum). */
const AIRTABLE_REC = "rec[A-Za-z0-9]{14}";
/** Logical phase-item id (`item_…`) accepted by resolvePhaseItemRowId. */
const ITEM_LOGICAL = "item_[A-Za-z0-9_]+";
/** Path segment ids used by allowlisted dynamic routes — not `[^/]+` (blocks meta/prefill siblings). */
const ROUTE_ID = `(?:${UUID}|${AIRTABLE_REC}|${ITEM_LOGICAL})`;
/** Posting-brief / post ids are UUIDs only. */
const BRIEF_ID = UUID;

export const AGENT_ALLOWLIST: readonly AgentAllowRule[] = [
  {
    method: "GET",
    pattern: "GET /api/posting-briefs",
    test: (p) => p === "/api/posting-briefs",
  },
  {
    method: "GET",
    pattern: "GET /api/posting-briefs/[id]",
    test: (p) => new RegExp(`^/api/posting-briefs/${BRIEF_ID}$`).test(p),
  },
  {
    method: "GET",
    pattern: "GET /api/va/story-link-schedule",
    test: (p) => p === "/api/va/story-link-schedule",
  },
  {
    method: "GET",
    pattern: "GET /api/va/marketing/phones",
    test: (p) => p === "/api/va/marketing/phones",
  },
  {
    method: "GET",
    pattern: "GET /api/va/marketing/accounts",
    test: (p) => p === "/api/va/marketing/accounts",
  },
  {
    method: "GET",
    pattern: "GET /api/va/task-phases",
    test: (p) => p === "/api/va/task-phases",
  },
  {
    method: "GET",
    pattern: "GET /api/winner-videos",
    test: (p) => p === "/api/winner-videos",
  },
  {
    method: "POST",
    pattern: "POST /api/posting-briefs/[id]/posts/[postId]/posted",
    test: (p) =>
      new RegExp(`^/api/posting-briefs/${BRIEF_ID}/posts/${BRIEF_ID}/posted$`).test(p),
  },
  {
    method: "POST",
    pattern: "POST /api/va/task-shift/start",
    test: (p) => p === "/api/va/task-shift/start",
  },
  {
    method: "POST",
    pattern: "POST /api/va/phase-items/[id]/complete",
    test: (p) => new RegExp(`^/api/va/phase-items/${ROUTE_ID}/complete$`).test(p),
  },
  {
    method: "POST",
    pattern: "POST /api/va/marketing/report-shadowban",
    test: (p) => p === "/api/va/marketing/report-shadowban",
  },
  {
    method: "POST",
    pattern: "POST /api/va/marketing/report-restriction-lifted",
    test: (p) => p === "/api/va/marketing/report-restriction-lifted",
  },
] as const;

/**
 * Strip query only. Do not collapse trailing/double slashes — those forms are denied.
 */
export function normalizeAgentPathname(pathname: string): string {
  const raw = (pathname.split("?")[0] ?? "").trim() || "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

/** Reject ambiguous path forms that must never authenticate. */
function isAmbiguousAgentPath(pathname: string): boolean {
  if (pathname.includes("//")) return true;
  if (pathname.length > 1 && pathname.endsWith("/")) return true;
  if (/%2f/i.test(pathname)) return true;
  return false;
}

export function matchAgentAllowlist(
  method: string,
  pathname: string,
): AgentAllowRule | null {
  const m = method.trim().toUpperCase();
  const path = normalizeAgentPathname(pathname);
  if (!path.startsWith("/api/")) return null;
  if (isAmbiguousAgentPath(path)) return null;
  for (const rule of AGENT_ALLOWLIST) {
    if (rule.method === m && rule.test(path)) return rule;
  }
  return null;
}

export function isAgentAllowlisted(method: string, pathname: string): boolean {
  return matchAgentAllowlist(method, pathname) != null;
}
