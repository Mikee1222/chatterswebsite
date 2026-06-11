import {
  createRecord,
  deleteRecord,
  listAllRecords,
  listRecords,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { awardPoints } from "@/services/points-engine";
import { listAllUsers } from "@/services/users";
import { CHALLENGE_METRICS, type ChallengeMetric } from "@/lib/challenges";

export { CHALLENGE_METRICS, daysRemainingYmd, getChallengeStatus } from "@/lib/challenges";
export type { ChallengeMetric, ChallengeStatus } from "@/lib/challenges";

const CHALLENGES = "challenges";
const PROGRESS = "challenge_progress";

export type ChallengeRow = {
  id: string;
  title: string;
  description: string;
  target_metric: ChallengeMetric;
  target_value: number;
  reward_points: number;
  start_date: string;
  end_date: string;
  active: boolean;
  created_by?: string;
  /** Comma-separated Airtable user IDs; empty = all chatters. */
  assigned_users: string;
};

type ChallengeFields = {
  title?: string;
  description?: string;
  target_metric?: string;
  target_value?: number;
  reward_points?: number;
  start_date?: string;
  end_date?: string;
  active?: boolean;
  created_by?: string;
  assigned_users?: string;
};

type ProgressFields = {
  challenge_id?: string;
  user_id?: string;
  current_value?: number;
  completed?: boolean;
  completed_at?: string;
  updated_at?: string;
};

function escapeFormulaString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function ymd(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
}

function mapChallenge(rec: AirtableRecord<ChallengeFields>): ChallengeRow {
  const f = rec.fields ?? {};
  const metric = String(f.target_metric ?? "");
  const safeMetric = (CHALLENGE_METRICS as readonly string[]).includes(metric)
    ? (metric as ChallengeMetric)
    : "transactions";
  return {
    id: rec.id,
    title: String(f.title ?? "").trim() || "Untitled",
    description: String(f.description ?? "").trim(),
    target_metric: safeMetric,
    target_value: Math.max(0, Math.floor(Number(f.target_value ?? 0))),
    reward_points: Math.max(0, Math.floor(Number(f.reward_points ?? 0))),
    start_date: ymd(f.start_date),
    end_date: ymd(f.end_date),
    active: Boolean(f.active),
    created_by: f.created_by ? String(f.created_by) : undefined,
    assigned_users: String(f.assigned_users ?? "").trim(),
  };
}

/** Parsed assigned user IDs from `assigned_users` CSV (empty array = all chatters). */
export function parseChallengeAssignedUserIds(raw: string | undefined): string[] {
  if (raw == null || !String(raw).trim()) return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function challengeAppliesToUser(ch: ChallengeRow, userId: string): boolean {
  const ids = parseChallengeAssignedUserIds(ch.assigned_users);
  if (ids.length === 0) return true;
  return ids.includes(userId.trim());
}

function isLiveInWindow(c: ChallengeRow, today: string): boolean {
  if (!c.active) return false;
  if (!c.start_date || !c.end_date) return false;
  return c.start_date <= today && c.end_date >= today;
}

export async function getActiveChallenges(userId: string): Promise<ChallengeRow[]> {
  const uid = userId.trim();
  const records = await listAllRecords<ChallengeFields>(CHALLENGES, {
    _caller: "challenges.getActiveChallenges",
  });
  const today = getTodayYmdAthens();
  return records
    .map((r) => mapChallenge(r as AirtableRecord<ChallengeFields>))
    .filter((c) => isLiveInWindow(c, today) && (!uid || challengeAppliesToUser(c, uid)))
    .sort((a, b) => a.end_date.localeCompare(b.end_date));
}

export async function getAllChallengesForAdmin(): Promise<ChallengeRow[]> {
  const records = await listAllRecords<ChallengeFields>(CHALLENGES, {
    _caller: "challenges.getAllChallengesForAdmin",
  });
  return records
    .map((r) => mapChallenge(r as AirtableRecord<ChallengeFields>))
    .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));
}

export type ChallengeProgressRow = {
  id: string;
  challenge_id: string;
  user_id: string;
  current_value: number;
  completed: boolean;
  completed_at: string;
};

function mapProgress(rec: AirtableRecord<ProgressFields>): ChallengeProgressRow {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    challenge_id: String(f.challenge_id ?? "").trim(),
    user_id: String(f.user_id ?? "").trim(),
    current_value: Math.max(0, Number(f.current_value ?? 0)),
    completed: Boolean(f.completed),
    completed_at: String(f.completed_at ?? "").trim(),
  };
}

function progressUpdatedRecently(fields: ProgressFields | undefined): boolean {
  const raw = fields?.updated_at;
  if (raw == null || String(raw).trim() === "") return false;
  const t = new Date(String(raw)).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 1000;
}

function airtableUnknownField(err: unknown, field: string): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("UNKNOWN_FIELD_NAME") && msg.includes(field);
}

async function createChallengeProgressRow(fields: Record<string, unknown>): Promise<void> {
  try {
    await createRecord<ProgressFields>(PROGRESS, fields as ProgressFields);
  } catch (e) {
    if (!airtableUnknownField(e, "updated_at")) throw e;
    const { updated_at: _u, ...rest } = fields;
    await createRecord<ProgressFields>(PROGRESS, rest as ProgressFields);
  }
}

async function updateChallengeProgressRow(recordId: string, fields: Record<string, unknown>): Promise<void> {
  try {
    await updateRecord<ProgressFields>(PROGRESS, recordId, fields as ProgressFields);
  } catch (e) {
    if (!airtableUnknownField(e, "updated_at")) throw e;
    const { updated_at: _u, ...rest } = fields;
    await updateRecord<ProgressFields>(PROGRESS, recordId, rest as ProgressFields);
  }
}

export async function getChallengeProgress(
  userId: string,
  challengeId: string
): Promise<ChallengeProgressRow | null> {
  if (!userId.trim() || !challengeId.trim()) return null;
  const { records } = await listRecords<ProgressFields>(PROGRESS, {
    filterByFormula: `AND({user_id} = "${escapeFormulaString(userId)}", {challenge_id} = "${escapeFormulaString(challengeId)}")`,
    pageSize: 1,
    _caller: "challenges.getChallengeProgress",
  });
  const r = records[0];
  return r ? mapProgress(r as AirtableRecord<ProgressFields>) : null;
}

export type ChallengeWithPersonalProgress = ChallengeRow & {
  progress: ChallengeProgressRow | null;
  current_value: number;
  completed: boolean;
};

export async function getAllChallengesWithProgress(userId: string): Promise<ChallengeWithPersonalProgress[]> {
  const active = await getActiveChallenges(userId);
  if (!userId.trim() || active.length === 0) return [];

  const allProgress = await listAllRecords<ProgressFields>(PROGRESS, {
    _caller: "challenges.getAllChallengesWithProgress",
  });
  const byChallenge = new Map<string, ChallengeProgressRow>();
  for (const r of allProgress) {
    const row = mapProgress(r as AirtableRecord<ProgressFields>);
    if (row.user_id !== userId.trim()) continue;
    if (row.challenge_id) byChallenge.set(row.challenge_id, row);
  }

  return active.map((c) => {
    const p = byChallenge.get(c.id) ?? null;
    const current_value = p ? (p.completed ? c.target_value : Math.min(c.target_value, Math.max(0, p.current_value))) : 0;
    return {
      ...c,
      progress: p,
      current_value,
      completed: Boolean(p?.completed),
    };
  });
}

async function findProgressRecord(
  userId: string,
  challengeId: string
): Promise<{ id: string; fields: ProgressFields } | null> {
  const { records } = await listRecords<ProgressFields>(PROGRESS, {
    filterByFormula: `AND({user_id} = "${escapeFormulaString(userId)}", {challenge_id} = "${escapeFormulaString(challengeId)}")`,
    pageSize: 1,
    _caller: "challenges.findProgressRecord",
  });
  const r = records[0];
  return r ? { id: r.id, fields: (r.fields as ProgressFields) ?? {} } : null;
}

async function challengesMatchingMetricInWindow(metric: ChallengeMetric, userId: string): Promise<ChallengeRow[]> {
  const uid = userId.trim();
  const today = getTodayYmdAthens();
  const all = await listAllRecords<ChallengeFields>(CHALLENGES, { _caller: "challenges.challengesMatchingMetricInWindow" });
  return all
    .map((r) => mapChallenge(r as AirtableRecord<ChallengeFields>))
    .filter(
      (c) => c.target_metric === metric && isLiveInWindow(c, today) && (!uid || challengeAppliesToUser(c, uid))
    );
}

async function completeChallengeIfNeeded(userId: string, ch: ChallengeRow, current: number): Promise<void> {
  if (!userId?.trim()) return;
  if (current < ch.target_value) return;
  const row = await findProgressRecord(userId, ch.id);
  if (row?.fields.completed) return;

  const reward = Math.max(0, Math.floor(ch.reward_points));
  if (reward > 0) {
    await awardPoints(userId, reward, `Challenge: ${ch.title}`, "challenge", ch.id);
  }

  const doneIso = new Date().toISOString();
  if (row) {
    await updateChallengeProgressRow(row.id, {
      current_value: ch.target_value,
      completed: true,
      completed_at: doneIso,
      updated_at: doneIso,
    });
  } else {
    await createChallengeProgressRow({
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
      title: "🏆 Challenge Completed!",
      body: `🎉 You completed '${safeTitle}' and earned ${reward} pts!`,
      entity_type: "challenge",
      entity_id: ch.id,
    });
  } catch (e) {
    console.error("[challenges] challenge_completed notify failed", e);
  }
}

/**
 * Increment progress for all live challenges that use this metric.
 * Caps `current_value` at `target_value`, then awards points once when completed.
 */
export async function updateChallengeProgress(
  userId: string,
  metric: ChallengeMetric,
  incrementBy: number
): Promise<void> {
  if (!userId.trim() || !Number.isFinite(incrementBy) || incrementBy <= 0) return;
  try {
    const list = await challengesMatchingMetricInWindow(metric, userId);
    for (const ch of list) {
      const existing = await findProgressRecord(userId, ch.id);
      if (existing?.fields.completed) continue;
      if (progressUpdatedRecently(existing?.fields)) continue;

      const prev = existing ? Math.max(0, Number(existing.fields.current_value ?? 0)) : 0;
      const bumped = Math.max(0, prev + incrementBy);
      const next = Math.min(ch.target_value, bumped);
      const nowIso = new Date().toISOString();

      if (existing) {
        await updateChallengeProgressRow(existing.id, {
          current_value: next,
          updated_at: nowIso,
        });
      } else {
        await createChallengeProgressRow({
          challenge_id: ch.id,
          user_id: userId,
          current_value: next,
          completed: false,
          updated_at: nowIso,
        });
      }
      await completeChallengeIfNeeded(userId, ch, next);
    }
  } catch (e) {
    console.error("[challenges] updateChallengeProgress failed", { userId, metric, incrementBy, error: e });
  }
}

/** Safety pass: ensure any progress row that should be completed gets reward (idempotent if already completed). */
export async function checkAndCompleteChallenges(userId: string, metric: ChallengeMetric): Promise<void> {
  const list = await challengesMatchingMetricInWindow(metric, userId);
  for (const ch of list) {
    const row = await findProgressRecord(userId, ch.id);
    if (!row || row.fields.completed) continue;
    const cur = Math.max(0, Number(row.fields.current_value ?? 0));
    if (cur >= ch.target_value) {
      await completeChallengeIfNeeded(userId, ch, cur);
    }
  }
}

/** Completed participants per challenge id (for admin aggregate bar). */
export async function getCompletionCountsByChallenge(): Promise<Record<string, number>> {
  const all = await listAllRecords<ProgressFields>(PROGRESS, { _caller: "challenges.getCompletionCountsByChallenge" });
  const out: Record<string, number> = {};
  for (const r of all) {
    const f = r.fields ?? {};
    if (!f.completed) continue;
    const cid = String(f.challenge_id ?? "").trim();
    if (!cid) continue;
    out[cid] = (out[cid] ?? 0) + 1;
  }
  return out;
}

export async function activeChatterCount(): Promise<number> {
  const users = await listAllUsers();
  return users.filter((u) => u.role === "chatter" && (!u.status || u.status.toLowerCase() === "active")).length;
}

export async function deleteProgressForChallenge(challengeId: string): Promise<void> {
  const all = await listAllRecords<ProgressFields>(PROGRESS, { _caller: "challenges.deleteProgressForChallenge" });
  for (const r of all) {
    if (String(r.fields?.challenge_id ?? "").trim() === challengeId) {
      await deleteRecord(PROGRESS, r.id);
    }
  }
}
