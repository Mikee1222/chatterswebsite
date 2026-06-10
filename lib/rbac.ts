import { redirect } from "next/navigation";
import type { AuthUser } from "@/lib/auth-config";
import { ROUTES } from "@/lib/routes";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { DEFAULT_ROLE_PERMISSIONS, type Permission } from "@/lib/permissions";
import { getRolePermissions } from "@/services/roles";
import type { UserRole } from "@/types";

const CACHE_TTL_MS = 60_000;

type CacheEntry = {
  permissions: Set<Permission>;
  expiresAt: number;
};

const rolePermissionsCache = new Map<string, CacheEntry>();

function resolveRoleForPermissions(user: AuthUser): UserRole {
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

  const set = new Set(perms);
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

/** Invalidate cached permissions (e.g. after role upsert). */
export function invalidateRolePermissionsCache(roleName?: string): void {
  if (roleName) {
    rolePermissionsCache.delete(roleName.trim().toLowerCase());
    return;
  }
  rolePermissionsCache.clear();
}
