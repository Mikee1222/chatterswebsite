/**
 * Supabase backend for services/challenges.ts
 */

import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbSelectEq,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { awardPoints } from "@/services/points-engine";
import { listAllUsers } from "@/services/users";
import { challengeMetricKind, isChallengeMetric, isInflowwChallengeMetric, type ChallengeMetric } from "@/lib/challenges";
import type { ChallengeProgressRow, ChallengeRow, ChallengeWithPersonalProgress } from "./challenges";
import { challengeAppliesToUser } from "./challenges";

const CHALLENGES = "challenges";
const PROGRESS = "challenge_progress";

type ChallengeSbRow = SbRow & {
  title?: string | null;
  description?: string | null;
  target_metric?: string | null;
  target_value?: number | null;
  reward_points?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  active?: boolean | null;
  created_by?: string | null;
  assigned_users?: string | null;
};

type ProgressSbRow = SbRow & {
  challenge_id?: string | null;
  user_id?: string | null;
  current_value?: number | null;
  completed?: boolean | null;
  completed_at?: string | null;
  updated_at?: string | null;
};

function ymd(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
}

function normalizeStoredTargetValue(metric: ChallengeMetric, raw: unknown): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 1;
  const kind = challengeMetricKind(metric);
  if (kind === "count") return Math.max(1, Math.floor(n));
  if (kind === "hours") return Math.max(0.1, Math.round(n * 100) / 100);
  if (kind === "rate_pct") return Math.max(0.1, Math.min(100, Math.round(n * 100) / 100));
  return Math.max(0.01, Math.round(n * 100) / 100);
}

function mapChallenge(row: ChallengeSbRow): ChallengeRow {
  const metric = String(row.target_metric ?? "");
  const safeMetric = isChallengeMetric(metric) ? metric : "transactions";
  return {
    id: publicId(row),
    title: String(row.title ?? "").trim() || "Untitled",
    description: String(row.description ?? "").trim(),
    target_metric: safeMetric,
    target_value: normalizeStoredTargetValue(safeMetric, row.target_value),
    reward_points: Math.max(0, Math.floor(Number(row.reward_points ?? 0))),
    start_date: ymd(row.start_date),
    end_date: ymd(row.end_date),
    active: Boolean(row.active),
    created_by: row.created_by ? String(row.created_by) : undefined,
    assigned_users: String(row.assigned_users ?? "").trim(),
  };
}

function mapProgress(row: ProgressSbRow): ChallengeProgressRow {
  return {
    id: publicId(row),
    challenge_id: String(row.challenge_id ?? "").trim(),
    user_id: String(row.user_id ?? "").trim(),
    current_value: Math.max(0, Number(row.current_value ?? 0)),
    completed: Boolean(row.completed),
    completed_at: String(row.completed_at ?? "").trim(),
  };
}

function isLiveInWindow(c: ChallengeRow, today: string): boolean {
  if (!c.active) return false;
  if (!c.start_date || !c.end_date) return false;
  return c.start_date <= today && c.end_date >= today;
}

export async function getActiveChallenges(userId: string): Promise<ChallengeRow[]> {
  const uid = userId.trim();
  const rows = await sbSelectAll<ChallengeSbRow>(CHALLENGES);
  const today = getTodayYmdAthens();
  return rows
    .map(mapChallenge)
    .filter((c) => isLiveInWindow(c, today) && (!uid || challengeAppliesToUser(c, uid)))
    .sort((a, b) => a.end_date.localeCompare(b.end_date));
}

export async function getAllChallengesForAdmin(): Promise<ChallengeRow[]> {
  const rows = await sbSelectAll<ChallengeSbRow>(CHALLENGES);
  return rows
    .map(mapChallenge)
    .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));
}

export async function getChallengeProgress(
  userId: string,
  challengeId: string
): Promise<ChallengeProgressRow | null> {
  if (!userId.trim() || !challengeId.trim()) return null;
  const rows = await sbSelectAll<ProgressSbRow>(PROGRESS);
  const match = rows
    .map(mapProgress)
    .find((p) => p.user_id === userId.trim() && p.challenge_id === challengeId.trim());
  return match ?? null;
}

export async function getAllChallengesWithProgress(
  userId: string
): Promise<ChallengeWithPersonalProgress[]> {
  const uid = userId.trim();
  const active = await getActiveChallenges(uid);
  if (!uid || active.length === 0) return [];

  const { getUserInflowwLinkByPublicId } = await import("@/services/infloww-daily-stats");
  const link = await getUserInflowwLinkByPublicId(uid).catch(() => null);
  const linked = Boolean(link && link.infloww_employee_id > 0);

  const visible = active.filter((c) => {
    if (!isInflowwChallengeMetric(c.target_metric)) return true;
    return linked;
  });
  if (visible.length === 0) return [];

  const allProgress = await sbSelectAll<ProgressSbRow>(PROGRESS);
  const byChallenge = new Map<string, ChallengeProgressRow>();
  for (const r of allProgress) {
    const row = mapProgress(r);
    if (row.user_id !== uid) continue;
    if (row.challenge_id) byChallenge.set(row.challenge_id, row);
  }

  const { fetchProgress } = await import("@/services/infloww-challenge-progress");
  const out: ChallengeWithPersonalProgress[] = [];

  for (const c of visible) {
    const p = byChallenge.get(c.id) ?? null;
    if (isInflowwChallengeMetric(c.target_metric) && !p?.completed) {
      try {
        const fetched = await fetchProgress(
          c.target_metric,
          { startYmd: c.start_date, endYmd: c.end_date },
          uid
        );
        if (fetched.unavailable) {
          out.push({
            ...c,
            progress: p,
            current_value: p ? Math.min(c.target_value, Math.max(0, p.current_value)) : 0,
            completed: false,
            progress_unavailable: true,
            progress_unavailable_reason: fetched.unavailable_reason,
          });
          continue;
        }
        await setChallengeProgressAbsolute(uid, c, fetched.value);
        const refreshed = await findProgressRecord(uid, c.id);
        const completed = Boolean(refreshed?.mapped.completed);
        const current_value = completed
          ? c.target_value
          : Math.min(c.target_value, Math.max(0, fetched.value));
        out.push({
          ...c,
          progress: refreshed?.mapped ?? null,
          current_value,
          completed,
        });
        continue;
      } catch (e) {
        console.error("[challenges:sb] infloww progress fetch failed", {
          userId: uid,
          challengeId: c.id,
          error: e,
        });
      }
    }

    const current_value = p
      ? p.completed
        ? c.target_value
        : Math.min(c.target_value, Math.max(0, p.current_value))
      : 0;
    out.push({ ...c, progress: p, current_value, completed: Boolean(p?.completed) });
  }

  return out;
}

async function findProgressRecord(
  userId: string,
  challengeId: string
): Promise<{ id: string; row: ProgressSbRow; mapped: ChallengeProgressRow } | null> {
  const rows = await sbSelectAll<ProgressSbRow>(PROGRESS);
  for (const r of rows) {
    const mapped = mapProgress(r);
    if (mapped.user_id === userId.trim() && mapped.challenge_id === challengeId.trim()) {
      return { id: publicId(r), row: r, mapped };
    }
  }
  return null;
}

async function challengesMatchingMetricInWindow(
  metric: ChallengeMetric,
  userId: string
): Promise<ChallengeRow[]> {
  const uid = userId.trim();
  const today = getTodayYmdAthens();
  const all = await sbSelectAll<ChallengeSbRow>(CHALLENGES);
  return all
    .map(mapChallenge)
    .filter(
      (c) =>
        c.target_metric === metric &&
        isLiveInWindow(c, today) &&
        (!uid || challengeAppliesToUser(c, uid))
    );
}

async function completeChallengeIfNeeded(
  userId: string,
  ch: ChallengeRow,
  current: number
): Promise<void> {
  if (!userId?.trim()) return;
  if (current < ch.target_value) return;
  const row = await findProgressRecord(userId, ch.id);
  if (row?.mapped.completed) return;

  const reward = Math.max(0, Math.floor(ch.reward_points));
  if (reward > 0) {
    await awardPoints(userId, reward, `Challenge: ${ch.title}`, "challenge", ch.id);
  }

  const doneIso = new Date().toISOString();
  if (row) {
    await sbUpdateByPublicId(PROGRESS, row.id, {
      current_value: ch.target_value,
      completed: true,
      completed_at: doneIso,
      updated_at: doneIso,
    });
  } else {
    await sbInsert(PROGRESS, {
      challenge_id: ch.id,
      user_id: userId,
      current_value: ch.target_value,
      completed: true,
      completed_at: doneIso,
      updated_at: doneIso,
    });
  }

  try {
    const { notifyByRoleConfig } = await import("@/services/notification-service");
    const { NOTIFICATION_EVENT } = await import("@/lib/notification-types");
    const safeTitle = ch.title.replace(/'/g, "ʼ");
    await notifyByRoleConfig(NOTIFICATION_EVENT.CHALLENGE_COMPLETED, {
      recipient_mode: "personal_only",
      personal_user_id: userId,
      title: "🏆 Challenge completed!",
      body: `You completed '${safeTitle}' and earned ${reward} pts!`,
      entity_type: "challenge",
      entity_id: ch.id,
    });
  } catch (e) {
    console.error("[challenges:sb] challenge_completed notify failed", e);
  }
}

export async function updateChallengeProgress(
  userId: string,
  metric: ChallengeMetric,
  incrementBy: number
): Promise<void> {
  if (isInflowwChallengeMetric(metric)) return;
  const uid = userId.trim();
  if (!uid || !Number.isFinite(incrementBy) || incrementBy <= 0) return;
  try {
    const challenges = await challengesMatchingMetricInWindow(metric, uid);
    for (const ch of challenges) {
      const existing = await findProgressRecord(uid, ch.id);
      if (existing?.mapped.completed) continue;
      const prev = existing?.mapped.current_value ?? 0;
      const next = Math.min(ch.target_value, Math.max(0, prev + incrementBy));
      const now = new Date().toISOString();
      if (existing) {
        await sbUpdateByPublicId(PROGRESS, existing.id, {
          current_value: next,
          updated_at: now,
        });
      } else {
        await sbInsert(PROGRESS, {
          challenge_id: ch.id,
          user_id: uid,
          current_value: next,
          completed: false,
          updated_at: now,
        });
      }
      await completeChallengeIfNeeded(uid, ch, next);
    }
  } catch (e) {
    console.error("[challenges:sb] updateChallengeProgress failed", {
      userId,
      metric,
      incrementBy,
      error: e,
    });
  }
}

export async function setChallengeProgressAbsolute(
  userId: string,
  challenge: ChallengeRow,
  absoluteValue: number
): Promise<void> {
  const uid = userId.trim();
  if (!uid || !Number.isFinite(absoluteValue)) return;
  try {
    const existing = await findProgressRecord(uid, challenge.id);
    if (existing?.mapped.completed) return;
    const next = Math.min(challenge.target_value, Math.max(0, absoluteValue));
    const now = new Date().toISOString();
    if (existing) {
      await sbUpdateByPublicId(PROGRESS, existing.id, {
        current_value: next,
        updated_at: now,
      });
    } else {
      await sbInsert(PROGRESS, {
        challenge_id: challenge.id,
        user_id: uid,
        current_value: next,
        completed: false,
        updated_at: now,
      });
    }
    await completeChallengeIfNeeded(uid, challenge, next);
  } catch (e) {
    console.error("[challenges:sb] setChallengeProgressAbsolute failed", {
      userId,
      challengeId: challenge.id,
      error: e,
    });
  }
}

/** After Infloww sync: push absolute progress for live Infloww challenges. */
export async function refreshInflowwChallengesAfterSync(params?: {
  publicUserIds?: string[];
}): Promise<void> {
  try {
    const { listUsersWithInflowwEmployeeId } = await import("@/services/infloww-daily-stats");
    const { fetchProgress } = await import("@/services/infloww-challenge-progress");
    let users = await listUsersWithInflowwEmployeeId();
    if (params?.publicUserIds?.length) {
      const want = new Set(params.publicUserIds.map((x) => x.trim()).filter(Boolean));
      users = users.filter((u) => want.has(u.publicId) || want.has(u.uuid));
    }
    const today = getTodayYmdAthens();
    const all = await sbSelectAll<ChallengeSbRow>(CHALLENGES);
    const liveInfloww = all
      .map(mapChallenge)
      .filter((c) => isInflowwChallengeMetric(c.target_metric) && isLiveInWindow(c, today));

    if (!liveInfloww.length || !users.length) return;

    for (const user of users) {
      for (const ch of liveInfloww) {
        if (!challengeAppliesToUser(ch, user.publicId)) continue;
        try {
          if (!isInflowwChallengeMetric(ch.target_metric)) continue;
          const fetched = await fetchProgress(
            ch.target_metric,
            { startYmd: ch.start_date, endYmd: ch.end_date },
            user.publicId
          );
          if (fetched.unavailable) continue;
          await setChallengeProgressAbsolute(user.publicId, ch, fetched.value);
        } catch (e) {
          console.error("[challenges:sb] refreshInfloww after sync failed", {
            userId: user.publicId,
            challengeId: ch.id,
            error: e,
          });
        }
      }
    }
  } catch (e) {
    console.error("[challenges:sb] refreshInflowwChallengesAfterSync failed", e);
  }
}

export async function checkAndCompleteChallenges(
  userId: string,
  metric: ChallengeMetric
): Promise<void> {
  const uid = userId.trim();
  if (!uid) return;
  const challenges = await challengesMatchingMetricInWindow(metric, uid);
  for (const ch of challenges) {
    const existing = await findProgressRecord(uid, ch.id);
    await completeChallengeIfNeeded(uid, ch, existing?.mapped.current_value ?? 0);
  }
}

export async function getCompletionCountsByChallenge(): Promise<Record<string, number>> {
  const rows = await sbSelectAll<ProgressSbRow>(PROGRESS);
  const out: Record<string, number> = {};
  for (const r of rows) {
    const p = mapProgress(r);
    if (!p.completed || !p.challenge_id) continue;
    out[p.challenge_id] = (out[p.challenge_id] ?? 0) + 1;
  }
  return out;
}

export async function activeChatterCount(): Promise<number> {
  const users = await listAllUsers();
  return users.filter(
    (u) => u.role === "chatter" && (!u.status || u.status.toLowerCase() === "active")
  ).length;
}

export async function deleteProgressForChallenge(challengeId: string): Promise<void> {
  const id = challengeId.trim();
  if (!id) return;
  const rows = await sbSelectEq<ProgressSbRow>(PROGRESS, "challenge_id", id);
  for (const r of rows) {
    await sbDeleteByPublicId(PROGRESS, publicId(r));
  }
}

export async function createChallenge(
  fields: Record<string, unknown>
): Promise<{ id: string }> {
  const inserted = await sbInsert<ChallengeSbRow>(CHALLENGES, fields);
  return { id: publicId(inserted) };
}

export async function updateChallenge(
  id: string,
  fields: Record<string, unknown>
): Promise<void> {
  if (!Object.keys(fields).length) return;
  await sbUpdateByPublicId(CHALLENGES, id, fields);
}

export async function deleteChallenge(id: string): Promise<void> {
  await sbDeleteByPublicId(CHALLENGES, id);
  await deleteProgressForChallenge(id);
}
