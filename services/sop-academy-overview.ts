"use server";

import { buildProgressUserSummaries, getProgressByRole } from "@/services/sop-progress";
import { getSignoffsByRole } from "@/services/sop-signoff";
import {
  getAllSopRolesAdmin,
  getFunctionsByRoleAdmin,
  getSopRoleMemberUserIds,
} from "@/services/sops";
import { listAllUsers } from "@/services/users";
import type {
  SopAcademyBehindMember,
  SopAcademyOverview,
  SopAcademyOverviewRoleStats,
} from "@/types";

export type { SopAcademyOverview, SopAcademyOverviewRoleStats, SopAcademyBehindMember };

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000));
}

function resolveLastActivityAt(
  progressRows: Array<{ completed_at: string; created_at?: string }>,
  fallbackIso?: string
): string | null {
  const completions = progressRows.map((r) => r.completed_at).filter(Boolean).sort();
  if (completions.length > 0) return completions.at(-1) ?? null;
  const created = progressRows.map((r) => r.created_at).filter(Boolean).sort();
  if (created.length > 0) return created[0] ?? null;
  return fallbackIso ?? null;
}

export async function getAcademyOverview(): Promise<SopAcademyOverview> {
  const [roles, users] = await Promise.all([getAllSopRolesAdmin(), listAllUsers()]);
  const academyRoles = roles.filter((r) => r.is_active && r.academy_mode);

  const userNames = new Map(
    users.map((u) => [u.id, (u.full_name ?? "").trim() || u.email || u.id])
  );

  const roleStats: SopAcademyOverviewRoleStats[] = [];
  const behind: SopAcademyBehindMember[] = [];
  let total_in_training = 0;
  let total_completed = 0;
  let total_signed_off = 0;
  let total_members = 0;

  for (const role of academyRoles) {
    const memberIds = getSopRoleMemberUserIds(role, users);
    if (memberIds.length === 0) continue;

    const [functions, progress, signoffs] = await Promise.all([
      getFunctionsByRoleAdmin(role.id),
      getProgressByRole(role.id),
      getSignoffsByRole(role.id),
    ]);

    const activeFunctions = functions.filter((f) => f.is_active);
    const totalFunctions = activeFunctions.length;
    const signoffByUser = new Map(
      signoffs
        .filter((s) => Boolean(s.user_id))
        .map((s) => [s.user_id, s.signed_at] as [string, string])
    );
    const summaries = buildProgressUserSummaries(
      progress.by_user,
      totalFunctions,
      userNames,
      activeFunctions,
      signoffByUser
    );
    const summaryByUser = new Map(summaries.map((s) => [s.user_id, s]));

    let roleCompleted = 0;
    let roleSignedOff = 0;
    let roleInTraining = 0;
    let rateSum = 0;

    for (const userId of memberIds) {
      const summary = summaryByUser.get(userId);
      const signedOff = signoffByUser.has(userId);
      const completedCount = summary?.completed_count ?? 0;
      const percent = summary?.percent ?? 0;
      const fullyComplete = totalFunctions > 0 && completedCount >= totalFunctions;

      if (fullyComplete) {
        roleCompleted += 1;
        total_completed += 1;
      } else {
        roleInTraining += 1;
        total_in_training += 1;

        const userProgress = progress.by_user.get(userId) ?? [];
        const lastActivity = resolveLastActivityAt(userProgress, role.created_at);
        behind.push({
          user_id: userId,
          user_name: userNames.get(userId) ?? userId,
          role_id: role.id,
          role_name: role.name,
          completed_count: completedCount,
          total_functions: totalFunctions,
          percent,
          days_behind: daysSince(lastActivity),
          last_activity_at: lastActivity,
          signed_off: signedOff,
        });
      }

      if (signedOff) {
        roleSignedOff += 1;
        total_signed_off += 1;
      }

      rateSum += fullyComplete ? 100 : percent;
      total_members += 1;
    }

    const member_count = memberIds.length;
    roleStats.push({
      role_id: role.id,
      role_name: role.name,
      role_color: role.color,
      total_functions: totalFunctions,
      member_count,
      completed_count: roleCompleted,
      signed_off_count: roleSignedOff,
      in_training_count: roleInTraining,
      completion_rate: member_count > 0 ? Math.round(rateSum / member_count) : 0,
    });
  }

  behind.sort(
    (a, b) =>
      b.days_behind - a.days_behind ||
      a.percent - b.percent ||
      a.user_name.localeCompare(b.user_name)
  );

  const chart_by_role = roleStats.map((r) => ({
    name: r.role_name,
    completion_rate: r.completion_rate,
    in_training: r.in_training_count,
    completed: r.completed_count,
    signed_off: r.signed_off_count,
  }));

  return {
    total_members,
    total_in_training,
    total_completed,
    total_signed_off,
    roles: roleStats.sort((a, b) => a.role_name.localeCompare(b.role_name)),
    behind,
    chart_by_role,
    chart_totals: [
      { name: "In training", value: total_in_training },
      { name: "Completed training", value: total_completed },
      { name: "Signed off", value: total_signed_off },
    ],
  };
}
