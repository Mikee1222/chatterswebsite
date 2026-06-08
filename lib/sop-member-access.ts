import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSopRoleById, sopRoleMatchesMember } from "@/services/sops";
import type { AuthUser } from "@/lib/auth-config";
import type { SopAuthRole, SopRole } from "@/types";

const MEMBER_STAFF_ROLES = new Set(["chatter", "virtual_assistant"]);

export function isSopMemberSession(session: AuthUser | null): boolean {
  if (!session) return false;
  const staffRole = getEffectiveStaffRole(session);
  return staffRole != null && MEMBER_STAFF_ROLES.has(staffRole);
}

export async function getMemberAccessibleSopRole(
  session: AuthUser,
  roleRecordId: string
): Promise<SopRole | null> {
  const role = await getSopRoleById(roleRecordId);
  if (!role || !role.is_active) return null;

  const staffRole = getEffectiveStaffRole(session) as SopAuthRole | null;
  if (
    !sopRoleMatchesMember(role, {
      airtableUserId: session.airtableUserId,
      staffRole,
    })
  ) {
    return null;
  }

  return role;
}
