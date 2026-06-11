import {
  EVENT_TO_ROLE_CATEGORY,
  getEventDefaultValue,
} from "@/lib/notification-role-defaults";
import { getRoles } from "@/services/roles";
import type { NotificationEventType, RoleRecord } from "@/types";

const CACHE_TTL_MS = 60_000;

type CacheEntry<T> = { value: T; expiresAt: number };

const roleEventCache = new Map<string, CacheEntry<boolean>>();
let rolesCache: CacheEntry<RoleRecord[]> | null = null;

/** Clear role/event caches after role save (call from upsertRole). */
export function clearRoleNotificationCache(roleId?: string): void {
  rolesCache = null;
  if (!roleId) {
    roleEventCache.clear();
    return;
  }
  const prefix = `${roleId.trim().toLowerCase()}:`;
  for (const key of roleEventCache.keys()) {
    if (key.startsWith(prefix)) roleEventCache.delete(key);
  }
}

export async function getCachedRoles(): Promise<RoleRecord[]> {
  const now = Date.now();
  if (rolesCache && now < rolesCache.expiresAt) return rolesCache.value;
  const roles = await getRoles();
  rolesCache = { value: roles, expiresAt: now + CACHE_TTL_MS };
  return roles;
}

export function isRoleEventEnabled(role: RoleRecord, eventType: NotificationEventType): boolean {
  const roleId = role.role_id.trim().toLowerCase();
  const cacheKey = `${roleId}:${eventType}`;
  const now = Date.now();
  const cached = roleEventCache.get(cacheKey);
  if (cached && now < cached.expiresAt) return cached.value;

  const defaults = role.notification_defaults;
  const categoryKey = EVENT_TO_ROLE_CATEGORY[eventType];
  const enabled =
    !!defaults &&
    !!categoryKey &&
    getEventDefaultValue(defaults, categoryKey, eventType);

  roleEventCache.set(cacheKey, { value: enabled, expiresAt: now + CACHE_TTL_MS });
  return enabled;
}
