import { ROUTES } from "@/lib/routes";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

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
 * Paths under `/admin` that belong to `sharedPermissionNavItems`: they are gated purely by
 * a permission, so ANY role that holds the permission — including virtual_assistant — may
 * open them. Middleware lets these through so the request reaches the page; the admin layout
 * and the page's own `hasPermission` guard enforce the actual grant. Keep in sync with the
 * `/admin`-hosted entries in `sharedPermissionNavItems` (lib/nav-config.ts).
 */
const PERMISSION_GATED_ADMIN_PATHS: { path: string; permission: Permission }[] = [
  { path: ROUTES.admin.accounts, permission: PERMISSIONS.ACCOUNTS_VIEW },
  { path: ROUTES.admin.pdfMaker, permission: PERMISSIONS.PDF_MAKER_MANAGE },
];

/**
 * If `pathname` is a permission-gated shared admin path, return the permission that grants
 * access to it; otherwise return null.
 */
export function permissionForSharedAdminPath(pathname: string): Permission | null {
  const p = (pathname.split("?")[0] || "").replace(/\/$/, "") || "/";
  for (const entry of PERMISSION_GATED_ADMIN_PATHS) {
    const base = entry.path.replace(/\/$/, "");
    if (p === base || p.startsWith(`${base}/`)) return entry.permission;
  }
  return null;
}
