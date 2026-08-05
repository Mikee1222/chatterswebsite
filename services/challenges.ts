import {
  createRecord,
  deleteRecord,
  listAllRecords,
  listRecords,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { isSupabaseBackend } from "@/lib/data-backend";
import { awardPoints } from "@/services/points-engine";
import { listAllUsers } from "@/services/users";
import { challengeMetricKind, isChallengeMetric, isInflowwChallengeMetric, type ChallengeMetric } from "@/lib/challenges";

export { CHALLENGE_METRICS, daysRemainingYmd, getChallengeStatus, isInflowwChallengeMetric } from "@/lib/challenges";
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

function normalizeStoredTargetValue(metric: ChallengeMetric, raw: unknown): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 1;
  const kind = challengeMetricKind(metric);
  if (kind === "count") return Math.max(1, Math.floor(n));
  if (kind === "hours") return Math.max(0.1, Math.round(n * 100) / 100);
  if (kind === "rate_pct") return Math.max(0.1, Math.min(100, Math.round(n * 100) / 100));
  return Math.max(0.01, Math.round(n * 100) / 100);
}

function mapChallenge(rec: AirtableRecord<ChallengeFields>): ChallengeRow {
  const f = rec.fields ?? {};
  const metric = String(f.target_metric ?? "");
  const safeMetric = isChallengeMetric(metric) ? metric : "transactions";
  return {
    id: rec.id,
    title: String(f.title ?? "").trim() || "Untitled",
    description: String(f.description ?? "").trim(),
    target_metric: safeMetric,
    target_value: normalizeStoredTargetValue(safeMetric, f.target_value),
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
  if (isSupabaseBackend()) {
    return (await import("./challenges-supabase")).getActiveChallenges(userId);
  }
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
  if (isSupabaseBackend()) {
    return (await import("./challenges-supabase")).getAllChallengesForAdmin();
  }
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
  if (isSupabaseBackend()) {
    return (await import("./challenges-supabase")).getChallengeProgress(userId, challengeId);
  }
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
  /** Rate/derived Infloww metrics with no usable data yet. */
  progress_unavailable?: boolean;
  progress_unavailable_reason?: string;
};

async function buildInflowwChallengeProgress(
  userId: string,
  c: ChallengeRow,
  existing: ChallengeProgressRow | null
): Promise<ChallengeWithPersonalProgress> {
  const { fetchProgress } = await import("@/services/infloww-challenge-progress");
  const prog = await fetchProgress(
    c.target_metric as import("@/lib/challenges").InflowwChallengeMetric,
    { startYmd: c.start_date, endYmd: c.end_date },
    userId
  );

  if (prog.unavailable) {
    return {
      ...c,
      progress: existing,
      current_value: 0,
      completed: Boolean(existing?.completed),
      progress_unavailable: true,
      progress_unavailable_reason: prog.unavailable_reason,
    };
  }

  const raw = Math.max(0, prog.value);
  const current_value = existing?.completed ? c.target_value : Math.min(c.target_value, raw);
  return {
    ...c,
    progress: existing,
    current_value,
    completed: Boolean(existing?.completed),
  };
}

export async function getAllChallengesWithProgress(userId: string): Promise<ChallengeWithPersonalProgress[]> {
  if (isSupabaseBackend()) {
    return (await import("./challenges-supabase")).getAllChallengesWithProgress(userId);
  }
  const uid = userId.trim();
  const active = await getActiveChallenges(uid);
  if (!uid || active.length === 0) return [];

  const { getUserInflowwLinkByPublicId } = await import("@/services/infloww-daily-stats");
  const inflowwLink = await getUserInflowwLinkByPublicId(uid);
  const hasInfloww = Boolean(inflowwLink && inflowwLink.infloww_employee_id > 0);

  const allProgress = await listAllRecords<ProgressFields>(PROGRESS, {
    _caller: "challenges.getAllChallengesWithProgress",
  });
  const byChallenge = new Map<string, ChallengeProgressRow>();
  for (const r of allProgress) {
    const row = mapProgress(r as AirtableRecord<ProgressFields>);
    if (row.user_id !== uid) continue;
    if (row.challenge_id) byChallenge.set(row.challenge_id, row);
  }

  const out: ChallengeWithPersonalProgress[] = [];
  for (const c of active) {
    if (isInflowwChallengeMetric(c.target_metric)) {
      if (!hasInfloww) continue;
      out.push(await buildInflowwChallengeProgress(uid, c, byChallenge.get(c.id) ?? null));
      continue;
    }
    const p = byChallenge.get(c.id) ?? null;
    const current_value = p
      ? p.completed
        ? c.target_value
        : Math.min(c.target_value, Math.max(0, p.current_value))
      : 0;
    out.push({
      ...c,
      progress: p,
      current_value,
      completed: Boolean(p?.completed),
    });
  }
  return out;
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
      title: "🏆 Challenge completed!",
      body: `You completed '${safeTitle}' and earned ${reward} pts!`,
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
 * Infloww metrics are absolute (synced via setChallengeProgressAbsolute) — ignored here.
 */
export async function updateChallengeProgress(
  userId: string,
  metric: ChallengeMetric,
  incrementBy: number
): Promise<void> {
  if (isSupabaseBackend()) {
    return (await import("./challenges-supabase")).updateChallengeProgress(
      userId,
      metric,
      incrementBy
    );
  }
  if (isInflowwChallengeMetric(metric)) return;
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
  if (isSupabaseBackend()) {
    return (await import("./challenges-supabase")).checkAndCompleteChallenges(userId, metric);
  }
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
  if (isSupabaseBackend()) {
    return (await import("./challenges-supabase")).getCompletionCountsByChallenge();
  }
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
  if (isSupabaseBackend()) {
    return (await import("./challenges-supabase")).activeChatterCount();
  }
  const users = await listAllUsers();
  return users.filter((u) => u.role === "chatter" && (!u.status || u.status.toLowerCase() === "active")).length;
}

export async function deleteProgressForChallenge(challengeId: string): Promise<void> {
  if (isSupabaseBackend()) {
    return (await import("./challenges-supabase")).deleteProgressForChallenge(challengeId);
  }
  const all = await listAllRecords<ProgressFields>(PROGRESS, { _caller: "challenges.deleteProgressForChallenge" });
  for (const r of all) {
    if (String(r.fields?.challenge_id ?? "").trim() === challengeId) {
      await deleteRecord(PROGRESS, r.id);
    }
  }
}

/**
 * Set absolute progress for one challenge (used by Infloww metric sync).
 * Does not decrease a completed challenge.
 */
export async function setChallengeProgressAbsolute(
  userId: string,
  challenge: ChallengeRow,
  absoluteValue: number
): Promise<void> {
  if (isSupabaseBackend()) {
    return (await import("./challenges-supabase")).setChallengeProgressAbsolute(
      userId,
      challenge,
      absoluteValue
    );
  }
  const uid = userId.trim();
  if (!uid || !Number.isFinite(absoluteValue)) return;
  try {
    const existing = await findProgressRecord(uid, challenge.id);
    if (existing?.fields.completed) return;
    const next = Math.min(challenge.target_value, Math.max(0, absoluteValue));
    const nowIso = new Date().toISOString();
    if (existing) {
      await updateChallengeProgressRow(existing.id, {
        current_value: next,
        updated_at: nowIso,
      });
    } else {
      await createChallengeProgressRow({
        challenge_id: challenge.id,
        user_id: uid,
        current_value: next,
        completed: false,
        updated_at: nowIso,
      });
    }
    await completeChallengeIfNeeded(uid, challenge, next);
  } catch (e) {
    console.error("[challenges] setChallengeProgressAbsolute failed", {
      userId,
      challengeId: challenge.id,
      error: e,
    });
  }
}

/** Refresh Infloww-metric challenges for linked users after stats sync. */
export async function refreshInflowwChallengesAfterSync(params?: {
  publicUserIds?: string[];
}): Promise<void> {
  if (isSupabaseBackend()) {
    return (await import("./challenges-supabase")).refreshInflowwChallengesAfterSync(params);
  }

  const { listUsersWithInflowwEmployeeId } = await import("@/services/infloww-daily-stats");
  const { fetchProgress } = await import("@/services/infloww-challenge-progress");

  let users = await listUsersWithInflowwEmployeeId();
  if (params?.publicUserIds?.length) {
    const want = new Set(params.publicUserIds.map((x) => x.trim()).filter(Boolean));
    users = users.filter((u) => want.has(u.publicId) || want.has(u.uuid));
  }

  const today = getTodayYmdAthens();
  const all = await listAllRecords<ChallengeFields>(CHALLENGES, {
    _caller: "challenges.refreshInflowwChallengesAfterSync",
  });
  const liveInfloww = all
    .map((r) => mapChallenge(r as AirtableRecord<ChallengeFields>))
    .filter(
      (c) =>
        c.active &&
        isInflowwChallengeMetric(c.target_metric) &&
        c.start_date &&
        c.end_date &&
        c.start_date <= today &&
        c.end_date >= today
    );

  if (!liveInfloww.length || !users.length) return;

  for (const user of users) {
    for (const ch of liveInfloww) {
      if (!challengeAppliesToUser(ch, user.publicId)) continue;
      try {
        if (!isInflowwChallengeMetric(ch.target_metric)) continue;
        const prog = await fetchProgress(
          ch.target_metric,
          { startYmd: ch.start_date, endYmd: ch.end_date },
          user.publicId
        );
        if (prog.unavailable) continue;
        await setChallengeProgressAbsolute(user.publicId, ch, prog.value);
      } catch (e) {
        console.error("[challenges] refreshInflowwChallengesAfterSync failed", {
          userId: user.publicId,
          challengeId: ch.id,
          error: e,
        });
      }
    }
  }
}

export async function createChallenge(
  fields: Record<string, unknown>
): Promise<{ id: string }> {
  if (isSupabaseBackend()) {
    return (await import("./challenges-supabase")).createChallenge(fields);
  }
  const created = await createRecord(CHALLENGES, fields);
  return { id: created.id };
}

export async function updateChallenge(
  id: string,
  fields: Record<string, unknown>
): Promise<void> {
  if (isSupabaseBackend()) {
    return (await import("./challenges-supabase")).updateChallenge(id, fields);
  }
  await updateRecord(CHALLENGES, id, fields);
}

export async function deleteChallenge(id: string): Promise<void> {
  if (isSupabaseBackend()) {
    return (await import("./challenges-supabase")).deleteChallenge(id);
  }
  await deleteProgressForChallenge(id);
  await deleteRecord(CHALLENGES, id);
}
