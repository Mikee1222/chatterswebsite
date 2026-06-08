import { getProgressForUser } from "@/services/sop-progress";
import { getSignoffForUserRole } from "@/services/sop-signoff";
import {
  getAllSopRoles,
  getFunctionsByRole,
  sopRoleMatchesMember,
} from "@/services/sops";
import type {
  SopAcademyResume,
  SopAuthRole,
  SopCertificationBadge,
  SopFunction,
  SopRole,
} from "@/types";

function sortFunctions(items: SopFunction[]): SopFunction[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

export async function getMatchedAcademyRoles(
  opts: { airtableUserId: string | null; staffRole: SopAuthRole }
): Promise<SopRole[]> {
  const allRoles = await getAllSopRoles().catch(() => []);
  return allRoles
    .filter(
      (role) =>
        role.academy_mode &&
        sopRoleMatchesMember(role, {
          airtableUserId: opts.airtableUserId,
          staffRole: opts.staffRole,
        })
    )
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/** First incomplete academy role for resume banner (lowest sort_order). */
export async function getAcademyResumeForMember(
  userRecordId: string,
  opts: { airtableUserId: string | null; staffRole: SopAuthRole }
): Promise<SopAcademyResume | null> {
  const userId = userRecordId.trim();
  if (!userId) return null;

  const academyRoles = await getMatchedAcademyRoles(opts);
  if (academyRoles.length === 0) return null;

  for (const role of academyRoles) {
    const functions = await getFunctionsByRole(role.id).catch(() => []);
    const sorted = sortFunctions(functions.filter((f) => f.is_active));
    const total = sorted.length;
    if (total === 0) continue;

    const completedIds = await getProgressForUser(userId, role.id, sorted);
    const completedSet = new Set(completedIds);
    const completed_count = sorted.filter((f) => completedSet.has(f.id)).length;

    if (completed_count >= total) continue;

    const nextFn = sorted.find((f) => !completedSet.has(f.id));

    return {
      role_id: role.id,
      role_name: role.name,
      completed_count,
      total_functions: total,
      next_function_id: nextFn?.id ?? null,
    };
  }

  return null;
}

function isRoleCertified(signoffAt: string | null): boolean {
  return Boolean(signoffAt?.trim());
}

/** Certification badges derived from progress + signoffs (no extra table). */
export async function getCertificationBadgesForMember(
  userRecordId: string,
  opts: { airtableUserId: string | null; staffRole: SopAuthRole }
): Promise<SopCertificationBadge[]> {
  const userId = userRecordId.trim();
  if (!userId) return [];

  const academyRoles = await getMatchedAcademyRoles(opts);
  if (academyRoles.length === 0) return [];

  const badges: SopCertificationBadge[] = [];
  let allCertified = true;

  for (const role of academyRoles) {
    const functions = await getFunctionsByRole(role.id).catch(() => []);
    const sorted = sortFunctions(functions.filter((f) => f.is_active));
    const total = sorted.length;
    if (total === 0) {
      allCertified = false;
      continue;
    }

    const signoff = await getSignoffForUserRole(userId, role.id).catch(() => null);

    if (isRoleCertified(signoff?.signed_at ?? null)) {
      badges.push({
        kind: "role",
        label: `${role.name} Certified`,
        role_id: role.id,
        role_color: role.color,
      });
    } else {
      allCertified = false;
    }
  }

  if (allCertified && academyRoles.length > 0) {
    badges.push({
      kind: "master",
      label: "All training complete",
    });
  }

  return badges;
}

export function buildSopsDeepLink(resume: SopAcademyResume): string {
  const params = new URLSearchParams({ role: resume.role_id });
  if (resume.next_function_id) {
    params.set("step", resume.next_function_id);
  }
  return `/sops?${params.toString()}`;
}
