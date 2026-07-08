import { getRoles } from "@/services/roles";

/** Normalize RBAC role slugs stored on `sop_roles.auth_roles`. */
export function normalizeAuthRoleSlugs(slugs: string[]): string[] {
  return [...new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

export async function getKnownAuthRoleIds(): Promise<Set<string>> {
  const roles = await getRoles();
  return new Set(roles.map((r) => r.role_id.trim().toLowerCase()).filter(Boolean));
}

export function filterValidAuthRoleSlugs(slugs: string[], known: Set<string>): string[] {
  return normalizeAuthRoleSlugs(slugs).filter((s) => known.has(s));
}

export function findInvalidAuthRoleSlugs(slugs: string[], known: Set<string>): string[] {
  return normalizeAuthRoleSlugs(slugs).filter((s) => !known.has(s));
}
