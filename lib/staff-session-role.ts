import type { NavRole } from "@/lib/nav-config";
import type { AuthUser } from "./auth-config";

/** Matches Airtable `users.secondary_role` after normalizing `va` → `virtual_assistant`. */
export type StaffPairRole = "chatter" | "virtual_assistant";

/**
 * Effective chatter or VA mode for users with `secondary_role`, else primary staff role.
 * Admin/model/manager → null (not staff pair).
 */
export function getEffectiveStaffRole(user: AuthUser | null): StaffPairRole | null {
  if (!user) return null;
  if (user.secondary_role && (user.role === "chatter" || user.role === "virtual_assistant")) {
    if (user.active_role === "chatter" || user.active_role === "virtual_assistant") {
      return user.active_role;
    }
    if (user.role === "chatter" || user.role === "virtual_assistant") return user.role;
    return null;
  }
  if (user.role === "chatter" || user.role === "virtual_assistant") return user.role;
  return null;
}

export function hasDualStaffRole(user: AuthUser | null): boolean {
  return Boolean(user?.secondary_role && (user.role === "chatter" || user.role === "virtual_assistant"));
}

/** Nav + dashboard shell: chatter, VA, or non-staff roles unchanged. */
export function getNavRoleForSession(user: AuthUser): NavRole {
  const staff = getEffectiveStaffRole(user);
  if (staff === "chatter" || staff === "virtual_assistant") {
    return staff;
  }
  return user.role as NavRole;
}

/** The inactive staff hat for a chatter+VA pair (for role switcher target). */
export function getOtherStaffPairRole(user: AuthUser): StaffPairRole | null {
  if (!hasDualStaffRole(user)) return null;
  const primary =
    user.role === "chatter" || user.role === "virtual_assistant" ? user.role : null;
  const secondary = user.secondary_role;
  if (!primary || !secondary) return null;
  const cur = getEffectiveStaffRole(user);
  if (!cur) return null;
  return cur === primary ? secondary : primary;
}
