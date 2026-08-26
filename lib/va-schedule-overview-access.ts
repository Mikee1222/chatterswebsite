import { getPermissionGatedSharedAdminPaths } from "@/lib/nav-config";
import { ROUTES } from "@/lib/routes";
import type { Permission } from "@/lib/permissions";

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

/**
 * Paths under `/admin` that belong to shared / permission-gated admin nav: they are gated
 * purely by permission(s), so ANY role that holds one of them — including virtual_assistant —
 * may open them. Middleware lets these through so the request reaches the page; the admin
 * layout and the page's own `hasPermission` guard enforce the actual grant.
 *
 * Derived from `getPermissionGatedSharedAdminPaths()` (lib/nav-config.ts) — do not hardcode.
 * Returns the permission list for the matching path, or null when the path is not shared.
 */
export function permissionForSharedAdminPath(pathname: string): readonly Permission[] | null {
  const p = (pathname.split("?")[0] || "").replace(/\/$/, "") || "/";
  for (const entry of getPermissionGatedSharedAdminPaths()) {
    const base = entry.path.replace(/\/$/, "");
    if (p === base || p.startsWith(`${base}/`)) return entry.permissions;
  }
  return null;
}
