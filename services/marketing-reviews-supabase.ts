/**
 * Supabase backend for services/marketing-reviews.ts
 */
import {
  publicId,
  sbAirtableIdsForUuids,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  requireSbUuids,
  type SbRow,
} from "@/lib/supabase-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  SPOT_CHECK_STATUSES,
  SPOT_CHECK_TYPES,
  resolutionTimeNowMs,
  toReviewDateKey,
  type SpotCheckStatus,
  type SpotCheckType,
} from "@/lib/marketing-reviews-helpers";
import { addDaysAthensYmd } from "@/lib/airtable-datetime";
import {
  attachmentsFromSignedMap,
  batchSignUrlMap,
  uploadToPrivateStorage,
} from "@/lib/supabase-signed-url";
import type {
  DailyReviewFilters,
  MarketingSpotCheck,
  MarketingDailyReview,
  MarketingExecAudit,
  MarketingDailyReviewDetail,
  SpotCheckFilters,
  VaReviewHistorySummary,
} from "./marketing-reviews";

const TABLE_SPOT_CHECKS = "marketing_spot_checks";
const TABLE_DAILY_REVIEWS = "marketing_daily_reviews";
const TABLE_EXEC_AUDITS = "marketing_exec_audits";

type SpotCheckRow = SbRow & {
  subject?: string | null;
  timestamp?: string | null;
  manager_name?: string | null;
  manager_id?: string | null;
  type?: string | null;
  exec_va_id?: string | null;
  exec_va_name?: string | null;
  creator_id?: string | null;
  creator_name?: string | null;
  what_was_wrong?: string | null;
  action_taken?: string | null;
  status?: string | null;
  resolution_time?: number | null;
  attachments?: string[] | null;
};

type DailyReviewRow = SbRow & {
  review_label?: string | null;
  review_date?: string | null;
  overall_kpis_reviewed?: string[] | null;
  account_compliance_vs_master?: string[] | null;
  top_performer_id?: string | null;
  top_performer_name?: string | null;
  issues_found?: string | null;
  actions_assigned?: string | null;
  time_spent_minutes?: number | null;
  manager_name?: string | null;
  manager_id?: string | null;
  attachments?: string[] | null;
};

type ExecAuditRow = SbRow & {
  audit_label?: string | null;
  daily_review?: string[] | null;
  exec_va_id?: string | null;
  exec_va_name?: string | null;
  reviewing_day?: string | null;
  phase1_on_time?: boolean | null;
  phase2_on_time?: boolean | null;
  screenshots_authentic?: boolean | null;
  posting_compliance?: boolean | null;
  engagement_looks_real?: boolean | null;
  issues_found?: string | null;
  actions_taken?: string | null;
};

function coerceSpotCheckType(v: unknown): SpotCheckType {
  const s = String(v ?? "").trim() as SpotCheckType;
  return (SPOT_CHECK_TYPES as readonly string[]).includes(s) ? s : "Other";
}
function coerceSpotCheckStatus(v: unknown): SpotCheckStatus {
  const s = String(v ?? "").trim() as SpotCheckStatus;
  return (SPOT_CHECK_STATUSES as readonly string[]).includes(s) ? s : "Pending";
}
function coerceNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function attachmentFilename(url: string): string | undefined {
  return url.split("/").pop()?.replace(/^[a-f0-9]+_\d+\./, "") || undefined;
}

function mapSpotCheckSync(row: SpotCheckRow, signedMap: Map<string, string>): MarketingSpotCheck {
  const rawUrls = Array.isArray(row.attachments) ? row.attachments.filter((u): u is string => typeof u === "string" && u.length > 0) : [];
  return {
    id: publicId(row),
    subject: String(row.subject ?? ""),
    timestamp: row.timestamp ?? "",
    manager_name: String(row.manager_name ?? ""),
    manager_id: String(row.manager_id ?? ""),
    type: coerceSpotCheckType(row.type),
    exec_va_id: String(row.exec_va_id ?? ""),
    exec_va_name: String(row.exec_va_name ?? ""),
    creator_id: String(row.creator_id ?? ""),
    creator_name: String(row.creator_name ?? ""),
    what_was_wrong: String(row.what_was_wrong ?? ""),
    action_taken: String(row.action_taken ?? ""),
    status: coerceSpotCheckStatus(row.status),
    resolution_time: coerceNumber(row.resolution_time),
    attachments: attachmentsFromSignedMap(rawUrls, signedMap).map((a) => ({
      url: a.url,
      filename: a.filename ?? attachmentFilename(a.url),
    })),
  };
}

function mapDailyReviewSync(row: DailyReviewRow, signedMap: Map<string, string>): MarketingDailyReview {
  const rawUrls = Array.isArray(row.attachments) ? row.attachments.filter((u): u is string => typeof u === "string" && u.length > 0) : [];
  return {
    id: publicId(row),
    review_label: String(row.review_label ?? ""),
    review_date: row.review_date ?? "",
    overall_kpis_reviewed: Array.isArray(row.overall_kpis_reviewed) ? row.overall_kpis_reviewed.map(String) : [],
    account_compliance_vs_master: Array.isArray(row.account_compliance_vs_master) ? row.account_compliance_vs_master.map(String) : [],
    top_performer_id: String(row.top_performer_id ?? ""),
    top_performer_name: String(row.top_performer_name ?? ""),
    issues_found: String(row.issues_found ?? ""),
    actions_assigned: String(row.actions_assigned ?? ""),
    time_spent_minutes: coerceNumber(row.time_spent_minutes),
    manager_name: String(row.manager_name ?? ""),
    manager_id: String(row.manager_id ?? ""),
    attachments: attachmentsFromSignedMap(rawUrls, signedMap).map((a) => ({
      url: a.url,
      filename: a.filename ?? attachmentFilename(a.url),
    })),
  };
}

async function mapSpotCheck(row: SpotCheckRow): Promise<MarketingSpotCheck> {
  const signedMap = await batchSignUrlMap(
    Array.isArray(row.attachments) ? row.attachments.filter((u): u is string => typeof u === "string" && u.length > 0) : [],
  );
  return mapSpotCheckSync(row, signedMap);
}

async function mapDailyReview(row: DailyReviewRow): Promise<MarketingDailyReview> {
  const signedMap = await batchSignUrlMap(
    Array.isArray(row.attachments) ? row.attachments.filter((u): u is string => typeof u === "string" && u.length > 0) : [],
  );
  return mapDailyReviewSync(row, signedMap);
}

async function mapSpotChecksBatched(rows: SpotCheckRow[]): Promise<MarketingSpotCheck[]> {
  const allUrls = rows.flatMap((r) =>
    Array.isArray(r.attachments) ? r.attachments.filter((u): u is string => typeof u === "string" && u.length > 0) : [],
  );
  const signedMap = await batchSignUrlMap(allUrls);
  return rows.map((row) => mapSpotCheckSync(row, signedMap));
}

async function mapDailyReviewsBatched(rows: DailyReviewRow[]): Promise<MarketingDailyReview[]> {
  const allUrls = rows.flatMap((r) =>
    Array.isArray(r.attachments) ? r.attachments.filter((u): u is string => typeof u === "string" && u.length > 0) : [],
  );
  const signedMap = await batchSignUrlMap(allUrls);
  return rows.map((row) => mapDailyReviewSync(row, signedMap));
}

async function mapExecAudit(row: ExecAuditRow): Promise<MarketingExecAudit> {
  const dailyIds = await sbAirtableIdsForUuids(TABLE_DAILY_REVIEWS, row.daily_review);
  return {
    id: publicId(row),
    audit_label: String(row.audit_label ?? ""),
    daily_review_id: dailyIds[0] ?? "",
    exec_va_id: String(row.exec_va_id ?? ""),
    exec_va_name: String(row.exec_va_name ?? ""),
    reviewing_day: row.reviewing_day ?? "",
    phase1_on_time: row.phase1_on_time === true,
    phase2_on_time: row.phase2_on_time === true,
    screenshots_authentic: row.screenshots_authentic === true,
    posting_compliance: row.posting_compliance === true,
    engagement_looks_real: row.engagement_looks_real === true,
    issues_found: String(row.issues_found ?? ""),
    actions_taken: String(row.actions_taken ?? ""),
  };
}

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getSpotChecks(filters: SpotCheckFilters = {}): Promise<MarketingSpotCheck[]> {
  const sb = getSupabaseServiceClient();
  let q = sb.from(TABLE_SPOT_CHECKS).select("*").order("timestamp", { ascending: false });
  if (filters.exec_va_id?.trim()) q = q.eq("exec_va_id", filters.exec_va_id.trim());
  if (filters.creator_id?.trim()) q = q.eq("creator_id", filters.creator_id.trim());
  if (filters.manager_id?.trim()) q = q.eq("manager_id", filters.manager_id.trim());
  if (filters.manager_name?.trim()) q = q.ilike("manager_name", filters.manager_name.trim());
  if (filters.type) q = q.eq("type", filters.type);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.date_from?.trim()) q = q.gt("timestamp", filters.date_from.trim());
  // Inclusive end day: exclusive upper bound is start of the next calendar day.
  if (filters.date_to?.trim()) q = q.lt("timestamp", addDaysAthensYmd(filters.date_to.trim(), 1));
  if (filters.has_attachment === true) q = q.not("attachments", "eq", "{}");
  if (filters.has_attachment === false) q = q.or("attachments.is.null,attachments.eq.{}");
  if (filters.unresolved_only) {
    q = q.or("resolution_time.is.null,status.eq.Pending");
  }
  if (filters.min_unresolved_age_hours != null && Number.isFinite(filters.min_unresolved_age_hours)) {
    const cutoff = new Date(Date.now() - filters.min_unresolved_age_hours * 3600_000).toISOString();
    q = q.lt("timestamp", cutoff).or("resolution_time.is.null,status.eq.Pending");
  }
  const { data, error } = await q;
  if (error) throw new Error(`marketing_spot_checks: ${error.message}`);
  let rows = (data ?? []) as unknown as SpotCheckRow[];
  // Client-side attachment presence when PostgREST array filters are unreliable
  if (filters.has_attachment === true) {
    rows = rows.filter((r) => Array.isArray(r.attachments) && r.attachments.some((u) => Boolean(u)));
  } else if (filters.has_attachment === false) {
    rows = rows.filter((r) => !Array.isArray(r.attachments) || r.attachments.every((u) => !u));
  }
  return mapSpotChecksBatched(rows);
}

export async function getSpotCheckById(id: string): Promise<MarketingSpotCheck | null> {
  const row = await sbSelectByPublicId<SpotCheckRow>(TABLE_SPOT_CHECKS, id);
  return row ? mapSpotCheck(row) : null;
}

export async function createSpotCheck(
  data: Partial<MarketingSpotCheck> & { manager_name: string }
): Promise<MarketingSpotCheck> {
  const now = new Date().toISOString();
  const status = data.status ?? "Pending";
  const subject =
    data.subject?.trim() ||
    `${data.type ?? "Spot check"} — ${data.exec_va_name || data.creator_name || "Review"}`;
  const resolution =
    data.resolution_time != null
      ? data.resolution_time
      : status === "Fixed"
        ? resolutionTimeNowMs()
        : undefined;
  const row = await sbInsert<SpotCheckRow>(TABLE_SPOT_CHECKS, {
    subject,
    timestamp: now,
    manager_name: data.manager_name,
    ...(data.manager_id ? { manager_id: data.manager_id } : {}),
    type: data.type ?? "Other",
    exec_va_id: data.exec_va_id ?? "",
    exec_va_name: data.exec_va_name ?? "",
    creator_id: data.creator_id ?? "",
    creator_name: data.creator_name ?? "",
    what_was_wrong: data.what_was_wrong ?? "",
    action_taken: data.action_taken ?? "",
    status,
    ...(resolution != null ? { resolution_time: resolution } : {}),
  });
  const spotCheck = await mapSpotCheck(row);

  const { listUsersWithPermission } = await import("@/services/users");
  const { PERMISSIONS } = await import("@/lib/permissions");
  const { notify } = await import("@/services/notification-service");
  const { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } = await import("@/lib/notification-types");
  const { spotCheckLogged } = await import("@/lib/notification-copy");
  const holders = await listUsersWithPermission(PERMISSIONS.SPOTCHECK_MANAGE).catch(() => []);
  const loggedCopy = spotCheckLogged(
    spotCheck.manager_name,
    spotCheck.type,
    spotCheck.exec_va_name || spotCheck.creator_name || ""
  );
  for (const u of holders) {
    if (!u.id) continue;
    if (spotCheck.manager_id && u.id === spotCheck.manager_id) continue;
    await notify({
      user_id: u.id,
      event_type: NOTIFICATION_EVENT.SPOT_CHECK_LOGGED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: loggedCopy.title,
      body: loggedCopy.body,
      entity_type: NOTIFICATION_ENTITY.SPOT_CHECK,
      entity_id: spotCheck.id,
      actor_user_id: spotCheck.manager_id || undefined,
      _triggerSource: "create_spot_check",
    }).catch((err) => console.error("[spot_check_logged] notify failed", err));
  }
  return spotCheck;
}

export async function updateSpotCheck(id: string, data: Partial<MarketingSpotCheck>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.subject !== undefined) patch.subject = data.subject;
  if (data.type !== undefined) patch.type = data.type;
  if (data.exec_va_id !== undefined) patch.exec_va_id = data.exec_va_id;
  if (data.exec_va_name !== undefined) patch.exec_va_name = data.exec_va_name;
  if (data.creator_id !== undefined) patch.creator_id = data.creator_id;
  if (data.creator_name !== undefined) patch.creator_name = data.creator_name;
  if (data.what_was_wrong !== undefined) patch.what_was_wrong = data.what_was_wrong;
  if (data.action_taken !== undefined) patch.action_taken = data.action_taken;
  if (data.status !== undefined) patch.status = data.status;
  if (data.resolution_time !== undefined) patch.resolution_time = data.resolution_time;
  const before = await getSpotCheckById(id);
  if (
    data.status === "Fixed" &&
    before &&
    before.status !== "Fixed" &&
    data.resolution_time === undefined &&
    before.resolution_time == null
  ) {
    patch.resolution_time = resolutionTimeNowMs();
  }
  if (Object.keys(patch).length === 0) return;
  await sbUpdateByPublicId(TABLE_SPOT_CHECKS, id, patch);
  if (
    before &&
    data.status !== undefined &&
    data.status !== before.status &&
    (data.status === "Fixed" || data.status === "Escalated") &&
    before.manager_id
  ) {
    const { notify } = await import("@/services/notification-service");
    const { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } = await import("@/lib/notification-types");
    const { spotCheckStatusChanged } = await import("@/lib/notification-copy");
    const statusCopy = spotCheckStatusChanged(
      data.status,
      before.exec_va_name || before.creator_name || ""
    );
    await notify({
      user_id: before.manager_id,
      event_type: NOTIFICATION_EVENT.SPOT_CHECK_STATUS_CHANGED,
      priority: data.status === "Escalated" ? NOTIFICATION_PRIORITY.HIGH : NOTIFICATION_PRIORITY.NORMAL,
      title: statusCopy.title,
      body: statusCopy.body,
      entity_type: NOTIFICATION_ENTITY.SPOT_CHECK,
      entity_id: id,
      _triggerSource: "update_spot_check_status",
    }).catch((err) => console.error("[spot_check_status_changed] notify failed", err));
  }
}

export async function deleteSpotCheck(id: string): Promise<void> {
  await sbDeleteByPublicId(TABLE_SPOT_CHECKS, id);
}

export async function uploadSpotCheckAttachments(
  id: string,
  files: Array<{ name: string; type: string; bytes: Uint8Array }>
): Promise<void> {
  const row = await sbSelectByPublicId<SpotCheckRow>(TABLE_SPOT_CHECKS, id);
  if (!row) throw new Error("Spot check not found");
  const existing = [...(row.attachments ?? [])];
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    if (!file.bytes.byteLength) continue;
    const safeName = (file.name || "attachment").replace(/[^a-zA-Z0-9._-]/g, "_");
    const token = await uploadToPrivateStorage({
      bucket: "attachments",
      objectPath: `marketing_spot_checks/${row.airtable_id || row.id}/attachments/${Date.now()}_${i}_${safeName}`,
      bytes: file.bytes,
      contentType: file.type || "application/octet-stream",
    });
    existing.push(token);
  }
  await sbUpdateByPublicId(TABLE_SPOT_CHECKS, id, { attachments: existing });
}

/** Append already-uploaded sb:// tokens (direct client upload). */
export async function appendSpotCheckAttachmentUrls(id: string, urls: string[]): Promise<void> {
  if (!urls.length) return;
  const row = await sbSelectByPublicId<SpotCheckRow>(TABLE_SPOT_CHECKS, id);
  if (!row) throw new Error("Spot check not found");
  const existing = [...(row.attachments ?? []), ...urls.filter(Boolean)];
  await sbUpdateByPublicId(TABLE_SPOT_CHECKS, id, { attachments: existing });
}

export async function getDailyReviews(filters: DailyReviewFilters = {}): Promise<MarketingDailyReview[]> {
  const sb = getSupabaseServiceClient();
  let q = sb.from(TABLE_DAILY_REVIEWS).select("*").order("review_date", { ascending: false });
  if (filters.manager_id?.trim()) q = q.eq("manager_id", filters.manager_id.trim());
  if (filters.manager_name?.trim()) q = q.ilike("manager_name", filters.manager_name.trim());
  if (filters.date_from?.trim()) q = q.gte("review_date", filters.date_from.trim());
  if (filters.date_to?.trim()) q = q.lte("review_date", filters.date_to.trim());
  const { data, error } = await q;
  if (error) throw new Error(`marketing_daily_reviews: ${error.message}`);
  let rows = (data ?? []) as unknown as DailyReviewRow[];
  if (filters.has_attachment === true) {
    rows = rows.filter((r) => Array.isArray(r.attachments) && r.attachments.some((u) => Boolean(u)));
  } else if (filters.has_attachment === false) {
    rows = rows.filter((r) => !Array.isArray(r.attachments) || r.attachments.every((u) => !u));
  }
  if (filters.has_issues === true) {
    rows = rows.filter((r) => String(r.issues_found ?? "").trim().length > 0);
  } else if (filters.has_issues === false) {
    rows = rows.filter((r) => String(r.issues_found ?? "").trim().length === 0);
  }
  let reviews = await mapDailyReviewsBatched(rows);
  if (filters.exec_audit_complete != null) {
    const details = await Promise.all(
      reviews.map(async (r) => {
        const audits = await getExecAuditsForDailyReview(r.id);
        const complete =
          audits.length > 0 &&
          audits.every(
            (a) =>
              Boolean(a.exec_va_id) &&
              (a.phase1_on_time || a.phase2_on_time || a.screenshots_authentic || a.posting_compliance || a.engagement_looks_real || a.issues_found || a.actions_taken),
          );
        return { id: r.id, complete };
      }),
    );
    const want = filters.exec_audit_complete;
    const allowed = new Set(details.filter((d) => d.complete === want).map((d) => d.id));
    reviews = reviews.filter((r) => allowed.has(r.id));
  }
  return reviews;
}

export async function getDailyReviewByDate(
  date: string,
  managerName: string,
  managerId?: string,
): Promise<MarketingDailyReview | null> {
  const targetKey = toReviewDateKey(date);
  if (!targetKey) return null;
  const managerTarget = managerName.trim().toLowerCase();
  const idTarget = managerId?.trim() ?? "";
  if (!managerTarget && !idTarget) return null;

  const sb = getSupabaseServiceClient();
  // Prefer stable manager_id when available; otherwise filter by name.
  if (idTarget) {
    const { data, error } = await sb
      .from(TABLE_DAILY_REVIEWS)
      .select("*")
      .eq("review_date", targetKey)
      .eq("manager_id", idTarget)
      .limit(1);
    if (error) throw new Error(`marketing_daily_reviews: ${error.message}`);
    const row = ((data ?? []) as unknown as DailyReviewRow[])[0];
    if (row) return mapDailyReview(row);
  }

  const { data, error } = await sb
    .from(TABLE_DAILY_REVIEWS)
    .select("*")
    .eq("review_date", targetKey)
    .limit(50);
  if (error) throw new Error(`marketing_daily_reviews: ${error.message}`);
  const match = ((data ?? []) as unknown as DailyReviewRow[]).find(
    (row) => String(row.manager_name ?? "").trim().toLowerCase() === managerTarget,
  );
  return match ? mapDailyReview(match) : null;
}

export async function getDailyReviewDetail(id: string): Promise<MarketingDailyReviewDetail | null> {
  const row = await sbSelectByPublicId<DailyReviewRow>(TABLE_DAILY_REVIEWS, id);
  if (!row) return null;
  const review = await mapDailyReview(row);
  const execAudits = await getExecAuditsForDailyReview(id);
  return { ...review, exec_audits: execAudits };
}

async function getExecAuditsForDailyReview(dailyReviewId: string): Promise<MarketingExecAudit[]> {
  const uuids = await sbUuidsForAirtableIds(TABLE_DAILY_REVIEWS, [dailyReviewId]);
  if (!uuids.length) return [];
  const targetUuid = uuids[0]!;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(TABLE_EXEC_AUDITS).select("*").contains("daily_review", [targetUuid]).order("exec_va_name", { ascending: true });
  if (error) throw new Error(`marketing_exec_audits: ${error.message}`);
  return Promise.all(((data ?? []) as unknown as ExecAuditRow[]).map(mapExecAudit));
}

export async function createDailyReview(
  data: Partial<MarketingDailyReview> & { manager_name: string; review_date: string }
): Promise<MarketingDailyReview> {
  const existing = await getDailyReviewByDate(data.review_date, data.manager_name, data.manager_id);
  if (existing) return existing;
  const label = data.review_label?.trim() || `Daily review — ${data.review_date}`;
  const row = await sbInsert<DailyReviewRow>(TABLE_DAILY_REVIEWS, {
    review_label: label,
    review_date: data.review_date,
    manager_name: data.manager_name,
    ...(data.manager_id ? { manager_id: data.manager_id } : {}),
    overall_kpis_reviewed: data.overall_kpis_reviewed ?? [],
    account_compliance_vs_master: data.account_compliance_vs_master ?? [],
    top_performer_id: data.top_performer_id ?? "",
    top_performer_name: data.top_performer_name ?? "",
    issues_found: data.issues_found ?? "",
    actions_assigned: data.actions_assigned ?? "",
    ...(data.time_spent_minutes != null ? { time_spent_minutes: data.time_spent_minutes } : {}),
  });
  const review = await mapDailyReview(row);

  const { listUsersWithPermission } = await import("@/services/users");
  const { PERMISSIONS } = await import("@/lib/permissions");
  const { notify } = await import("@/services/notification-service");
  const { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } = await import("@/lib/notification-types");
  const { dailyReviewSubmitted } = await import("@/lib/notification-copy");
  const holders = await listUsersWithPermission(PERMISSIONS.DAILY_REVIEW_MANAGE).catch(() => []);
  const copy = dailyReviewSubmitted(review.manager_name, toReviewDateKey(review.review_date) || review.review_date);
  for (const u of holders) {
    if (!u.id) continue;
    if (review.manager_id && u.id === review.manager_id) continue;
    await notify({
      user_id: u.id,
      event_type: NOTIFICATION_EVENT.DAILY_REVIEW_SUBMITTED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: copy.title,
      body: copy.body,
      entity_type: NOTIFICATION_ENTITY.DAILY_REVIEW,
      entity_id: review.id,
      actor_user_id: review.manager_id || undefined,
      _triggerSource: "create_daily_review",
    }).catch((err) => console.error("[daily_review_submitted] notify failed", err));
  }
  return review;
}

export async function updateDailyReview(id: string, data: Partial<MarketingDailyReview>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.review_label !== undefined) patch.review_label = data.review_label;
  if (data.review_date !== undefined) patch.review_date = data.review_date;
  if (data.overall_kpis_reviewed !== undefined) patch.overall_kpis_reviewed = data.overall_kpis_reviewed;
  if (data.account_compliance_vs_master !== undefined) patch.account_compliance_vs_master = data.account_compliance_vs_master;
  if (data.top_performer_id !== undefined) patch.top_performer_id = data.top_performer_id;
  if (data.top_performer_name !== undefined) patch.top_performer_name = data.top_performer_name;
  if (data.issues_found !== undefined) patch.issues_found = data.issues_found;
  if (data.actions_assigned !== undefined) patch.actions_assigned = data.actions_assigned;
  if (data.time_spent_minutes !== undefined) patch.time_spent_minutes = data.time_spent_minutes;
  if (data.manager_id !== undefined) patch.manager_id = data.manager_id;
  if (Object.keys(patch).length === 0) return;
  const before = await getDailyReviewByIdLite(id);
  await sbUpdateByPublicId(TABLE_DAILY_REVIEWS, id, patch);

  const { listUsersWithPermission } = await import("@/services/users");
  const { PERMISSIONS } = await import("@/lib/permissions");
  const { notify } = await import("@/services/notification-service");
  const { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } = await import("@/lib/notification-types");
  const { dailyReviewSaved } = await import("@/lib/notification-copy");
  const holders = await listUsersWithPermission(PERMISSIONS.DAILY_REVIEW_MANAGE).catch(() => []);
  const managerName = data.manager_name ?? before?.manager_name ?? "";
  const managerId = data.manager_id ?? before?.manager_id ?? "";
  const reviewDate = toReviewDateKey(data.review_date ?? before?.review_date ?? "") || "";
  const copy = dailyReviewSaved(managerName, reviewDate);
  for (const u of holders) {
    if (!u.id) continue;
    if (managerId && u.id === managerId) continue;
    await notify({
      user_id: u.id,
      event_type: NOTIFICATION_EVENT.DAILY_REVIEW_SAVED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: copy.title,
      body: copy.body,
      entity_type: NOTIFICATION_ENTITY.DAILY_REVIEW,
      entity_id: id,
      actor_user_id: managerId || undefined,
      _triggerSource: "update_daily_review",
    }).catch((err) => console.error("[daily_review_saved] notify failed", err));
  }
}

async function getDailyReviewByIdLite(id: string): Promise<MarketingDailyReview | null> {
  const row = await sbSelectByPublicId<DailyReviewRow>(TABLE_DAILY_REVIEWS, id);
  return row ? mapDailyReview(row) : null;
}

export async function uploadDailyReviewAttachments(
  id: string,
  files: Array<{ name: string; type: string; bytes: Uint8Array }>
): Promise<void> {
  const row = await sbSelectByPublicId<DailyReviewRow>(TABLE_DAILY_REVIEWS, id);
  if (!row) throw new Error("Daily review not found");
  const existing = [...(row.attachments ?? [])];
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    if (!file.bytes.byteLength) continue;
    const safeName = (file.name || "attachment").replace(/[^a-zA-Z0-9._-]/g, "_");
    const token = await uploadToPrivateStorage({
      bucket: "attachments",
      objectPath: `marketing_daily_reviews/${row.airtable_id || row.id}/attachments/${Date.now()}_${i}_${safeName}`,
      bytes: file.bytes,
      contentType: file.type || "application/octet-stream",
    });
    existing.push(token);
  }
  await sbUpdateByPublicId(TABLE_DAILY_REVIEWS, id, { attachments: existing });
}

/** Append already-uploaded sb:// tokens (direct client upload). */
export async function appendDailyReviewAttachmentUrls(id: string, urls: string[]): Promise<void> {
  if (!urls.length) return;
  const row = await sbSelectByPublicId<DailyReviewRow>(TABLE_DAILY_REVIEWS, id);
  if (!row) throw new Error("Daily review not found");
  const existing = [...(row.attachments ?? []), ...urls.filter(Boolean)];
  await sbUpdateByPublicId(TABLE_DAILY_REVIEWS, id, { attachments: existing });
}

export async function deleteDailyReview(id: string): Promise<void> {
  const audits = await getExecAuditsForDailyReview(id);
  for (const audit of audits) {
    await sbDeleteByPublicId(TABLE_EXEC_AUDITS, audit.id);
  }
  await sbDeleteByPublicId(TABLE_DAILY_REVIEWS, id);
}

export async function deleteExecAudit(id: string): Promise<void> {
  await sbDeleteByPublicId(TABLE_EXEC_AUDITS, id);
}

export async function getExecAuditById(id: string): Promise<MarketingExecAudit | null> {
  const row = await sbSelectByPublicId<ExecAuditRow>(TABLE_EXEC_AUDITS, id);
  return row ? mapExecAudit(row) : null;
}

export async function createExecAudit(
  data: Partial<MarketingExecAudit> & { daily_review_id: string }
): Promise<MarketingExecAudit> {
  const label =
    data.audit_label?.trim() ||
    `Exec audit — ${data.exec_va_name || "VA"} — ${data.reviewing_day || todayIsoDate()}`;
  const uuids = await requireSbUuids(TABLE_DAILY_REVIEWS, [data.daily_review_id], "daily_review");
  const row = await sbInsert<ExecAuditRow>(TABLE_EXEC_AUDITS, {
    audit_label: label,
    daily_review: uuids,
    exec_va_id: data.exec_va_id ?? "",
    exec_va_name: data.exec_va_name ?? "",
    reviewing_day: data.reviewing_day ?? todayIsoDate(),
    phase1_on_time: data.phase1_on_time === true,
    phase2_on_time: data.phase2_on_time === true,
    screenshots_authentic: data.screenshots_authentic === true,
    posting_compliance: data.posting_compliance === true,
    engagement_looks_real: data.engagement_looks_real === true,
    issues_found: data.issues_found ?? "",
    actions_taken: data.actions_taken ?? "",
  });
  return mapExecAudit(row);
}

export async function updateExecAudit(id: string, data: Partial<MarketingExecAudit>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.audit_label !== undefined) patch.audit_label = data.audit_label;
  if (data.daily_review_id !== undefined) {
    patch.daily_review = await requireSbUuids(
      TABLE_DAILY_REVIEWS,
      [data.daily_review_id],
      "daily_review"
    );
  }
  if (data.exec_va_id !== undefined) patch.exec_va_id = data.exec_va_id;
  if (data.exec_va_name !== undefined) patch.exec_va_name = data.exec_va_name;
  if (data.reviewing_day !== undefined) patch.reviewing_day = data.reviewing_day;
  if (data.phase1_on_time !== undefined) patch.phase1_on_time = data.phase1_on_time;
  if (data.phase2_on_time !== undefined) patch.phase2_on_time = data.phase2_on_time;
  if (data.screenshots_authentic !== undefined) patch.screenshots_authentic = data.screenshots_authentic;
  if (data.posting_compliance !== undefined) patch.posting_compliance = data.posting_compliance;
  if (data.engagement_looks_real !== undefined) patch.engagement_looks_real = data.engagement_looks_real;
  if (data.issues_found !== undefined) patch.issues_found = data.issues_found;
  if (data.actions_taken !== undefined) patch.actions_taken = data.actions_taken;
  if (Object.keys(patch).length === 0) return;
  await sbUpdateByPublicId(TABLE_EXEC_AUDITS, id, patch);
}

export async function getExecAuditsForVA(vaId: string): Promise<MarketingExecAudit[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(TABLE_EXEC_AUDITS).select("*").eq("exec_va_id", vaId.trim()).order("reviewing_day", { ascending: false });
  if (error) throw new Error(`marketing_exec_audits: ${error.message}`);
  return Promise.all(((data ?? []) as unknown as ExecAuditRow[]).map(mapExecAudit));
}

export async function getVaReviewHistory(vaId: string): Promise<VaReviewHistorySummary> {
  const since = daysAgoIso(30);
  const [spotChecks, execAudits] = await Promise.all([
    getSpotChecks({ exec_va_id: vaId, date_from: since }),
    getExecAuditsForVA(vaId),
  ]);

  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const sc of spotChecks) {
    byType[sc.type] = (byType[sc.type] ?? 0) + 1;
    byStatus[sc.status] = (byStatus[sc.status] ?? 0) + 1;
  }
  return {
    spot_check_count_30d: spotChecks.length,
    spot_check_by_type: byType,
    spot_check_by_status: byStatus,
    recent_exec_audits: execAudits.slice(0, 5),
  };
}
