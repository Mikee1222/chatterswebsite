"use server";

import { getTodayYmd } from "@/lib/weekly-program";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";
import { getAdminNotificationIds } from "@/services/admin-notification-settings";
import { notifyAdmins, notifyByRoleConfig } from "@/services/notification-service";
import { findExistingNotification } from "@/services/notifications";
import {
  buildProgressUserSummaries,
  getProgressByRole,
  getProgressForUser,
} from "@/services/sop-progress";
import { getSignoffForUserRole, getSignoffsByRole } from "@/services/sop-signoff";
import {
  getAllSopRoles,
  getFunctionsByRole,
  getSopRoleMemberUserIds,
  getSopRoleById,
} from "@/services/sops";
import { listAllUsers } from "@/services/users";

const ENTITY_TYPE = "sop_academy";
const AIRTABLE_EVENT = EVENT_TYPE_TO_AIRTABLE.system_alert ?? "system_alert";

function parseReminderThresholds(): number[] {
  const raw =
    process.env.SOP_ACADEMY_REMINDER_DAYS?.trim() ||
    process.env.SOP_ACADEMY_REMINDER_THRESHOLDS?.trim() ||
    "3,7";
  const parsed = raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parsed.length > 0 ? [...new Set(parsed)].sort((a, b) => a - b) : [3, 7];
}

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

async function sendAcademyReminderOnce(input: {
  userId: string;
  roleId: string;
  roleName: string;
  completed: number;
  total: number;
  thresholdDays: number;
  todayYmd: string;
}): Promise<boolean> {
  const entityId = `sop_academy:${input.roleId}:${input.userId}:${input.thresholdDays}d:${input.todayYmd}`;
  const exists = await findExistingNotification(
    input.userId,
    ENTITY_TYPE,
    entityId,
    AIRTABLE_EVENT
  ).catch(() => false);
  if (exists) return false;

  const title = "📚 SOP Academy";
  const body = `📚 Ολοκλήρωσε το training σου (${input.completed}/${input.total})`;

  await notifyByRoleConfig(NOTIFICATION_EVENT.SOP_ACADEMY_REMINDER, {
    recipient_mode: "personal_only",
    personal_user_id: input.userId,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title,
    body,
    entity_type: ENTITY_TYPE,
    entity_id: entityId,
  });
  return true;
}

export type SopAcademyReminderCronResult = {
  ok: true;
  scanned_roles: number;
  scanned_members: number;
  sent: number;
  skipped_complete: number;
  skipped_recent: number;
  thresholds_days: number[];
};

export async function runSopAcademyReminderCron(): Promise<SopAcademyReminderCronResult> {
  const todayYmd = getTodayYmd();
  const thresholds = parseReminderThresholds();
  const [roles, users] = await Promise.all([getAllSopRoles(), listAllUsers()]);
  const academyRoles = roles.filter((r) => r.academy_mode);

  let scanned_members = 0;
  let sent = 0;
  let skipped_complete = 0;
  let skipped_recent = 0;

  for (const role of academyRoles) {
    const memberIds = getSopRoleMemberUserIds(role, users);
    if (memberIds.length === 0) continue;

    const [functions, progress, signoffs] = await Promise.all([
      getFunctionsByRole(role.id),
      getProgressByRole(role.id),
      getSignoffsByRole(role.id),
    ]);

    const totalFunctions = functions.filter((f) => f.is_active).length;
    if (totalFunctions === 0) continue;

    const userNames = new Map(
      users.map((u) => [u.id, (u.full_name ?? "").trim() || u.email || u.id])
    );
    const activeFunctions = functions.filter((f) => f.is_active);
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

    for (const userId of memberIds) {
      scanned_members += 1;
      if (signoffByUser.has(userId)) {
        skipped_complete += 1;
        continue;
      }

      const summary = summaryByUser.get(userId);
      const completed = summary?.completed_count ?? 0;
      if (completed >= totalFunctions) {
        skipped_complete += 1;
        continue;
      }

      const userProgress = progress.by_user.get(userId) ?? [];
      const lastActivity = resolveLastActivityAt(userProgress, role.created_at);
      const inactiveDays = daysSince(lastActivity);

      let sentForUser = false;
      for (const threshold of thresholds) {
        if (inactiveDays < threshold) continue;
        const didSend = await sendAcademyReminderOnce({
          userId,
          roleId: role.id,
          roleName: role.name,
          completed,
          total: totalFunctions,
          thresholdDays: threshold,
          todayYmd,
        });
        if (didSend) {
          sent += 1;
          sentForUser = true;
        }
      }
      if (!sentForUser && inactiveDays < Math.min(...thresholds)) {
        skipped_recent += 1;
      }
    }
  }

  return {
    ok: true,
    scanned_roles: academyRoles.length,
    scanned_members,
    sent,
    skipped_complete,
    skipped_recent,
    thresholds_days: thresholds,
  };
}

export async function notifyAdminsSopTrainingComplete(input: {
  userId: string;
  userName: string;
  roleId: string;
  roleName: string;
  totalFunctions: number;
}): Promise<void> {
  const entityId = `sop_academy:complete:${input.roleId}:${input.userId}`;
  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.SOP_ACADEMY_TRAINING_COMPLETE,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "📚 SOP Training Completed",
    body: `🎉 ${input.userName} completed all ${input.totalFunctions} steps for ${input.roleName}.`,
    entity_type: ENTITY_TYPE,
    entity_id: entityId,
    actor_user_id: input.userId,
    _triggerSource: "sopAcademyTrainingComplete",
  });
}

export async function notifyAdminsSopSignoff(input: {
  userId: string;
  userName: string;
  roleId: string;
  roleName: string;
}): Promise<void> {
  const entityId = `sop_academy:signoff:${input.roleId}:${input.userId}`;
  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.SOP_ACADEMY_SIGNED_OFF,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "✅ SOP Training Sign-Off",
    body: `✅ ${input.userName} signed off on ${input.roleName} academy training.`,
    entity_type: ENTITY_TYPE,
    entity_id: entityId,
    actor_user_id: input.userId,
    _triggerSource: "sopAcademySignoff",
  });
}

/** After a function completion, notify admins once when all steps are done. */
export async function maybeNotifyAdminsTrainingComplete(
  userId: string,
  roleId: string
): Promise<void> {
  const [role, functions, users, adminIds] = await Promise.all([
    getSopRoleById(roleId),
    getFunctionsByRole(roleId),
    listAllUsers(),
    getAdminNotificationIds(),
  ]);
  if (!role?.academy_mode) return;
  const signoff = await getSignoffForUserRole(userId, roleId);
  if (signoff) return;

  const activeFunctions = functions.filter((f) => f.is_active);
  const totalFunctions = activeFunctions.length;
  if (totalFunctions === 0) return;

  const completedIds = await getProgressForUser(userId, roleId, activeFunctions);
  if (completedIds.length < totalFunctions) return;

  const entityId = `sop_academy:complete:${roleId}:${userId}`;
  const probeAdminId = adminIds[0];
  if (probeAdminId) {
    const exists = await findExistingNotification(
      probeAdminId,
      ENTITY_TYPE,
      entityId,
      AIRTABLE_EVENT
    ).catch(() => false);
    if (exists) return;
  }

  const user = users.find((u) => u.id === userId);
  const userName = (user?.full_name ?? "").trim() || user?.email || userId;

  await notifyAdminsSopTrainingComplete({
    userId,
    userName,
    roleId: role.id,
    roleName: role.name,
    totalFunctions,
  });
}
