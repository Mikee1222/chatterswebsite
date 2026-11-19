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

const UUID_OR_ID = "[^/]+";

export const AGENT_ALLOWLIST: readonly AgentAllowRule[] = [
  {
    method: "GET",
    pattern: "GET /api/posting-briefs",
    test: (p) => p === "/api/posting-briefs",
  },
  {
    method: "GET",
    pattern: "GET /api/posting-briefs/[id]",
    test: (p) => new RegExp(`^/api/posting-briefs/${UUID_OR_ID}$`).test(p),
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
      new RegExp(`^/api/posting-briefs/${UUID_OR_ID}/posts/${UUID_OR_ID}/posted$`).test(p),
  },
  {
    method: "POST",
    pattern: "POST /api/va/task-shift/start",
    test: (p) => p === "/api/va/task-shift/start",
  },
  {
    method: "POST",
    pattern: "POST /api/va/phase-items/[id]/complete",
    test: (p) => new RegExp(`^/api/va/phase-items/${UUID_OR_ID}/complete$`).test(p),
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

/** Normalize path: strip query, ensure leading slash, no trailing slash (except root). */
export function normalizeAgentPathname(pathname: string): string {
  const raw = (pathname.split("?")[0] ?? "").trim() || "/";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) return withSlash.slice(0, -1);
  return withSlash;
}

export function matchAgentAllowlist(
  method: string,
  pathname: string,
): AgentAllowRule | null {
  const m = method.trim().toUpperCase();
  const path = normalizeAgentPathname(pathname);
  if (!path.startsWith("/api/")) return null;
  for (const rule of AGENT_ALLOWLIST) {
    if (rule.method === m && rule.test(path)) return rule;
  }
  return null;
}

export function isAgentAllowlisted(method: string, pathname: string): boolean {
  return matchAgentAllowlist(method, pathname) != null;
}
