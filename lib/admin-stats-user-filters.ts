/**
 * Shared filters for admin production statistics.
 * Mirrors `shouldExcludeChatterFromLeaderboard` in points-engine, plus E2E/smoke accounts.
 */

export type AdminStatsUserLike = {
  full_name?: string | null;
  email?: string | null;
  status?: string | null;
};

/** True when the user should not appear in admin production stats (leaderboards, SOP overview, etc.). */
export function shouldExcludeUserFromAdminStats(user: AdminStatsUserLike): boolean {
  const status = String(user.status ?? "")
    .toLowerCase()
    .trim();
  if (status === "test" || status === "testing") return true;

  const name = String(user.full_name ?? "")
    .trim()
    .toLowerCase();
  if (
    name === "test" ||
    name === "bot" ||
    name === "testing member" ||
    name === "e2e-va" ||
    /\[e2e\]/.test(name) ||
    /\[test\]/.test(name) ||
    /\(test\)/.test(name) ||
    /\btest\s+account\b/.test(name) ||
    /^e2e[-_\s]/.test(name)
  ) {
    return true;
  }

  const email = String(user.email ?? "")
    .trim()
    .toLowerCase();
  if (
    email.endsWith("@gunzo.e2e") ||
    email.includes("@example.") ||
    email.includes("+test") ||
    email.startsWith("e2e-") ||
    email === "test@gmail.com" ||
    email === "test2@gmail.com" ||
    email === "test3@gmail.com"
  ) {
    return true;
  }

  return false;
}
