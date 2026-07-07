import type { StaffUserOption } from "@/components/staff-assignee-picker";
import type { UserRecord } from "@/types";

export function toStaffUserOptions(users: UserRecord[]): StaffUserOption[] {
  return users.map((u) => ({
    id: u.id,
    full_name: u.full_name ?? "",
    email: u.email ?? "",
    role: u.role ?? "",
  }));
}

export function buildRoleLabels(
  roles: Array<{ role_id: string; label?: string | null }>,
): Record<string, string> {
  return Object.fromEntries(
    roles.map((r) => [r.role_id, r.label?.trim() || r.role_id.replace(/_/g, " ")]),
  );
}

export function filterVaUsers(users: UserRecord[]): UserRecord[] {
  return users.filter(
    (u) => u.role === "virtual_assistant" || u.secondary_role === "virtual_assistant",
  );
}
