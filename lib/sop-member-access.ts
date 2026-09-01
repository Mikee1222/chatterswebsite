import { isCustomNavRole } from "@/lib/nav-config";
import { PERMISSIONS } from "@/lib/permissions";
import { hasPermission } from "@/lib/rbac";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSopRoleById, sopRoleMatchesMember } from "@/services/sops";
import type { AuthUser } from "@/lib/auth-config";
import type { SopRole } from "@/types";

const MEMBER_STAFF_ROLES = new Set(["chatter", "virtual_assistant"]);

/**
 * Member SOP viewer session — chatter/VA staff hats, or custom RBAC roles (e.g.
 * marketing-executive). Callers must also verify `sops:view` via {@link canAccessMemberSopViewer}.
 */
export function isSopMemberSession(session: AuthUser | null): boolean {
  if (!session) return false;
  const staffRole = getEffectiveStaffRole(session);
  if (staffRole != null && MEMBER_STAFF_ROLES.has(staffRole)) return true;
  return isCustomNavRole(session.role);
}

/** Permission + session guard for member `/sops` page and SOP member APIs. */
export async function canAccessMemberSopViewer(session: AuthUser | null): Promise<boolean> {
  if (!session) return false;
  if (!(await hasPermission(session, PERMISSIONS.SOPS_VIEW))) return false;
  return isSopMemberSession(session);
}

export async function getMemberAccessibleSopRole(
  session: AuthUser,
  roleRecordId: string
): Promise<SopRole | null> {
  const role = await getSopRoleById(roleRecordId);
  if (!role || !role.is_active) return null;

  const staffRole = getEffectiveStaffRole(session);
  if (
    !sopRoleMatchesMember(role, {
      airtableUserId: session.airtableUserId,
      memberRole: session.role,
      secondaryRole: staffRole && staffRole !== session.role ? staffRole : session.secondary_role,
    })
  ) {
    return null;
  }

  return role;
}
