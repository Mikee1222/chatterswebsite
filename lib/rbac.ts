import { redirect } from "next/navigation";
import type { AuthUser } from "@/lib/auth-config";
import { isCustomNavRole } from "@/lib/nav-config";
import { ROUTES } from "@/lib/routes";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, type Permission } from "@/lib/permissions";
import { getRolePermissions } from "@/services/roles";
import type { UserRole } from "@/types";

/** Admin, manager, or a custom role slug from Airtable `roles`. */
export function isAdminAreaUser(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  const role = user.role.trim().toLowerCase();
  return role === "admin" || role === "manager" || isCustomNavRole(user.role);
}

export function isSystemAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role.trim().toLowerCase() === "admin";
}

type RequireAdminRouteOptions = {
  permission?: Permission;
  /** Matches nav `adminOnly` — system admin role required. */
  adminOnly?: boolean;
};

/**
 * Guard admin routes: admin-area role, optional permission, optional admin-only flag.
 * Redirects to login or dashboard when access is denied.
 */
export async function requireAdminRoute(
  user: AuthUser | null | undefined,
  permissionOrOptions?: Permission | RequireAdminRouteOptions
): Promise<AuthUser> {
  if (!user) redirect(ROUTES.login);
  if (!isAdminAreaUser(user)) redirect(ROUTES.dashboard);

  let permission: Permission | undefined;
  let adminOnly = false;
  if (typeof permissionOrOptions === "string") {
    permission = permissionOrOptions;
  } else if (permissionOrOptions) {
    permission = permissionOrOptions.permission;
    adminOnly = permissionOrOptions.adminOnly ?? false;
  }

  if (adminOnly && !isSystemAdmin(user)) redirect(ROUTES.dashboard);
  if (permission && !(await hasPermission(user, permission))) redirect(ROUTES.dashboard);
  return user;
}

const CACHE_TTL_MS = 60_000;

type CacheEntry = {
  permissions: Set<Permission>;
  expiresAt: number;
};

const rolePermissionsCache = new Map<string, CacheEntry>();

/** Map retired weekly-program grants onto split chatter/VA program permissions. */
function expandLegacyProgramPermissions(perms: Set<Permission>): Set<Permission> {
  const expanded = new Set(perms);
  if (perms.has(PERMISSIONS.WEEKLY_PROGRAM_VIEW)) {
    expanded.add(PERMISSIONS.CHATTER_PROGRAM_VIEW);
    expanded.add(PERMISSIONS.VA_PROGRAM_VIEW);
  }
  if (perms.has(PERMISSIONS.WEEKLY_PROGRAM_MANAGE)) {
    expanded.add(PERMISSIONS.CHATTER_PROGRAM_MANAGE);
    expanded.add(PERMISSIONS.VA_PROGRAM_MANAGE);
  }
  return expanded;
}

/** Roles with va-tasks:manage always inherit task_progress:view (Progress Overview read access). */
function expandTaskProgressPermissions(perms: Set<Permission>): Set<Permission> {
  const expanded = expandLegacyProgramPermissions(perms);
  if (perms.has(PERMISSIONS.VA_TASKS_MANAGE)) {
    expanded.add(PERMISSIONS.TASK_PROGRESS_VIEW);
  }
  return expanded;
}

function resolveRoleForPermissions(user: AuthUser): string {
  const staff = getEffectiveStaffRole(user);
  if (staff) return staff;
  return user.role;
}

async function loadPermissionsForRole(role: string): Promise<Set<Permission>> {
  const key = role.trim().toLowerCase();
  const now = Date.now();
  const cached = rolePermissionsCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.permissions;
  }

  let perms: Permission[];
  try {
    perms = await getRolePermissions(key);
  } catch {
    perms = DEFAULT_ROLE_PERMISSIONS[key as UserRole] ?? [];
  }

  if (perms.length === 0) {
    perms = DEFAULT_ROLE_PERMISSIONS[key as UserRole] ?? [];
  }

  const set = expandTaskProgressPermissions(new Set(perms));
  rolePermissionsCache.set(key, { permissions: set, expiresAt: now + CACHE_TTL_MS });
  return set;
}

export async function hasPermission(
  user: AuthUser | null | undefined,
  permission: Permission
): Promise<boolean> {
  if (!user) return false;
  const role = resolveRoleForPermissions(user);
  const perms = await loadPermissionsForRole(role);
  return perms.has(permission);
}

export async function hasAnyPermission(
  user: AuthUser | null | undefined,
  permissions: Permission[]
): Promise<boolean> {
  if (!user || permissions.length === 0) return false;
  const role = resolveRoleForPermissions(user);
  const perms = await loadPermissionsForRole(role);
  return permissions.some((p) => perms.has(p));
}

export async function hasAllPermissions(
  user: AuthUser | null | undefined,
  permissions: Permission[]
): Promise<boolean> {
  if (!user || permissions.length === 0) return false;
  const role = resolveRoleForPermissions(user);
  const perms = await loadPermissionsForRole(role);
  return permissions.every((p) => perms.has(p));
}

/**
 * Server action / layout guard.
 * - No session → redirect to login.
 * - Missing permission → throw Error("Forbidden") (catch in actions that return { error }).
 */
export async function requirePermission(
  user: AuthUser | null | undefined,
  permission: Permission
): Promise<AuthUser> {
  if (!user) redirect(ROUTES.login);
  const allowed = await hasPermission(user, permission);
  if (!allowed) throw new Error("Forbidden");
  return user;
}

/** Invalidate in-memory permission cache (all roles or one role). */
export function clearRbacCache(roleName?: string): void {
  if (roleName) {
    rolePermissionsCache.delete(roleName.trim().toLowerCase());
    return;
  }
  rolePermissionsCache.clear();
}

/** @deprecated Use `clearRbacCache`. */
export const invalidateRolePermissionsCache = clearRbacCache;

/** All permissions granted to the session's effective role. */
export async function getUserPermissions(user: AuthUser): Promise<Permission[]> {
  const role = resolveRoleForPermissions(user);
  const set = await loadPermissionsForRole(role);
  return [...set];
}
