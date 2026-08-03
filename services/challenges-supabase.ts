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
import { CHALLENGE_METRICS, type ChallengeMetric } from "@/lib/challenges";
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

function mapChallenge(row: ChallengeSbRow): ChallengeRow {
  const metric = String(row.target_metric ?? "");
  const safeMetric = (CHALLENGE_METRICS as readonly string[]).includes(metric)
    ? (metric as ChallengeMetric)
    : "transactions";
  return {
    id: publicId(row),
    title: String(row.title ?? "").trim() || "Untitled",
    description: String(row.description ?? "").trim(),
    target_metric: safeMetric,
    target_value: Math.max(0, Math.floor(Number(row.target_value ?? 0))),
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
  const active = await getActiveChallenges(userId);
  if (!userId.trim() || active.length === 0) return [];
  const allProgress = await sbSelectAll<ProgressSbRow>(PROGRESS);
  const byChallenge = new Map<string, ChallengeProgressRow>();
  for (const r of allProgress) {
    const row = mapProgress(r);
    if (row.user_id !== userId.trim()) continue;
    if (row.challenge_id) byChallenge.set(row.challenge_id, row);
  }
  return active.map((c) => {
    const p = byChallenge.get(c.id) ?? null;
    const current_value = p
      ? p.completed
        ? c.target_value
        : Math.min(c.target_value, Math.max(0, p.current_value))
      : 0;
    return { ...c, progress: p, current_value, completed: Boolean(p?.completed) };
  });
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
