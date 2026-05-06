import { ROUTES } from "@/lib/routes";

/**
 * Admin routes a virtual_assistant may open (read-only schedule overview only).
 * Middleware and admin layout must stay in sync with this list.
 */
export function isVaReadableAdminSchedulePath(pathname: string): boolean {
  const p = (pathname.split("?")[0] || "").replace(/\/$/, "") || "/";
  if (p === "/admin/schedule-overview" || p.startsWith("/admin/schedule-overview/")) return true;
  const canonical = ROUTES.admin.modelSchedulesOverview.replace(/\/$/, "");
  if (p === canonical || p.startsWith(`${canonical}/`)) return true;
  return false;
}
