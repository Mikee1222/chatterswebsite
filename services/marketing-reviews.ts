"use server";

import {
  createRecord,
  deleteRecord,
  getRecord,
  listAllRecords,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { firstLinkedId, toLinkedRecordPayload } from "@/lib/airtable-linked";
import { uploadAirtableAttachment } from "@/lib/airtable-upload-attachment";
import { isSupabaseBackend } from "@/lib/data-backend";
import {
  SPOT_CHECK_STATUSES,
  SPOT_CHECK_TYPES,
  toReviewDateKey,
  type SpotCheckStatus,
  type SpotCheckType,
} from "@/lib/marketing-reviews-helpers";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { listUsersWithPermission } from "@/services/users";
import { PERMISSIONS } from "@/lib/permissions";
import { spotCheckLogged, spotCheckStatusChanged } from "@/lib/notification-copy";

export type { SpotCheckStatus, SpotCheckType } from "@/lib/marketing-reviews-helpers";

const TABLE_SPOT_CHECKS = "marketing_spot_checks";
const TABLE_DAILY_REVIEWS = "marketing_daily_reviews";
const TABLE_EXEC_AUDITS = "marketing_exec_audits";

export type ReviewAttachment = { url: string; filename?: string };

export interface MarketingSpotCheck {
  id: string;
  subject: string;
  timestamp: string;
  manager_name: string;
  manager_id: string;
  type: SpotCheckType;
  exec_va_id: string;
  exec_va_name: string;
  creator_id: string;
  creator_name: string;
  what_was_wrong: string;
  action_taken: string;
  status: SpotCheckStatus;
  resolution_time: number | null;
  attachments: ReviewAttachment[];
}

export interface MarketingDailyReview {
  id: string;
  review_label: string;
  review_date: string;
  overall_kpis_reviewed: string[];
  account_compliance_vs_master: string[];
  top_performer_id: string;
  top_performer_name: string;
  issues_found: string;
  actions_assigned: string;
  time_spent_minutes: number | null;
  manager_name: string;
  attachments: ReviewAttachment[];
}

export interface MarketingExecAudit {
  id: string;
  audit_label: string;
  daily_review_id: string;
  exec_va_id: string;
  exec_va_name: string;
  reviewing_day: string;
  phase1_on_time: boolean;
  phase2_on_time: boolean;
  screenshots_authentic: boolean;
  posting_compliance: boolean;
  engagement_looks_real: boolean;
  issues_found: string;
  actions_taken: string;
}

export interface MarketingDailyReviewDetail extends MarketingDailyReview {
  exec_audits: MarketingExecAudit[];
}

export interface SpotCheckFilters {
  exec_va_id?: string;
  creator_id?: string;
  type?: SpotCheckType | "";
  status?: SpotCheckStatus | "";
  date_from?: string;
  date_to?: string;
}

export interface VaReviewHistorySummary {
  spot_check_count_30d: number;
  spot_check_by_type: Record<string, number>;
  spot_check_by_status: Record<string, number>;
  recent_exec_audits: MarketingExecAudit[];
}

type SpotCheckFields = {
  subject?: string;
  timestamp?: string;
  manager_name?: string;
  manager_id?: string;
  type?: string;
  exec_va_id?: string;
  exec_va_name?: string;
  creator_id?: string;
  creator_name?: string;
  what_was_wrong?: string;
  action_taken?: string;
  status?: string;
  resolution_time?: number | string | null;
  attachments?: unknown;
};

type DailyReviewFields = {
  review_label?: string;
  review_date?: string;
  overall_kpis_reviewed?: string[];
  account_compliance_vs_master?: string[];
  top_performer_id?: string;
  top_performer_name?: string;
  issues_found?: string;
  actions_assigned?: string;
  time_spent_minutes?: number | string | null;
  manager_name?: string;
  attachments?: unknown;
};

type ExecAuditFields = {
  audit_label?: string;
  daily_review?: string | string[];
  exec_va_id?: string;
  exec_va_name?: string;
  reviewing_day?: string;
  phase1_on_time?: boolean;
  phase2_on_time?: boolean;
  screenshots_authentic?: boolean;
  posting_compliance?: boolean;
  engagement_looks_real?: boolean;
  issues_found?: string;
  actions_taken?: string;
};

function escapeFormulaString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '""');
}

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

function mapAttachments(v: unknown): ReviewAttachment[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((a): a is { url?: string; filename?: string } => a != null && typeof a === "object")
    .map((a) => ({ url: String(a.url ?? ""), filename: a.filename ? String(a.filename) : undefined }))
    .filter((a) => a.url.length > 0);
}

function mapSpotCheck(rec: AirtableRecord<SpotCheckFields>): MarketingSpotCheck {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    subject: String(f.subject ?? ""),
    timestamp: f.timestamp != null ? String(f.timestamp) : "",
    manager_name: String(f.manager_name ?? ""),
    manager_id: String(f.manager_id ?? ""),
    type: coerceSpotCheckType(f.type),
    exec_va_id: String(f.exec_va_id ?? ""),
    exec_va_name: String(f.exec_va_name ?? ""),
    creator_id: String(f.creator_id ?? ""),
    creator_name: String(f.creator_name ?? ""),
    what_was_wrong: String(f.what_was_wrong ?? ""),
    action_taken: String(f.action_taken ?? ""),
    status: coerceSpotCheckStatus(f.status),
    resolution_time: coerceNumber(f.resolution_time),
    attachments: mapAttachments(f.attachments),
  };
}

function mapDailyReview(rec: AirtableRecord<DailyReviewFields>): MarketingDailyReview {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    review_label: String(f.review_label ?? ""),
    review_date: f.review_date != null ? String(f.review_date) : "",
    overall_kpis_reviewed: Array.isArray(f.overall_kpis_reviewed) ? f.overall_kpis_reviewed.map(String) : [],
    account_compliance_vs_master: Array.isArray(f.account_compliance_vs_master)
      ? f.account_compliance_vs_master.map(String)
      : [],
    top_performer_id: String(f.top_performer_id ?? ""),
    top_performer_name: String(f.top_performer_name ?? ""),
    issues_found: String(f.issues_found ?? ""),
    actions_assigned: String(f.actions_assigned ?? ""),
    time_spent_minutes: coerceNumber(f.time_spent_minutes),
    manager_name: String(f.manager_name ?? ""),
    attachments: mapAttachments(f.attachments),
  };
}

function mapExecAudit(rec: AirtableRecord<ExecAuditFields>): MarketingExecAudit {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    audit_label: String(f.audit_label ?? ""),
    daily_review_id: firstLinkedId(f.daily_review) ?? "",
    exec_va_id: String(f.exec_va_id ?? ""),
    exec_va_name: String(f.exec_va_name ?? ""),
    reviewing_day: f.reviewing_day != null ? String(f.reviewing_day) : "",
    phase1_on_time: f.phase1_on_time === true,
    phase2_on_time: f.phase2_on_time === true,
    screenshots_authentic: f.screenshots_authentic === true,
    posting_compliance: f.posting_compliance === true,
    engagement_looks_real: f.engagement_looks_real === true,
    issues_found: String(f.issues_found ?? ""),
    actions_taken: String(f.actions_taken ?? ""),
  };
}

function buildSpotCheckFilter(filters: SpotCheckFilters): string | undefined {
  const parts: string[] = [];
  if (filters.exec_va_id?.trim()) {
    parts.push(`{exec_va_id} = "${escapeFormulaString(filters.exec_va_id.trim())}"`);
  }
  if (filters.creator_id?.trim()) {
    parts.push(`{creator_id} = "${escapeFormulaString(filters.creator_id.trim())}"`);
  }
  if (filters.type) {
    parts.push(`{type} = "${escapeFormulaString(filters.type)}"`);
  }
  if (filters.status) {
    parts.push(`{status} = "${escapeFormulaString(filters.status)}"`);
  }
  if (filters.date_from?.trim()) {
    parts.push(`IS_AFTER({timestamp}, "${escapeFormulaString(filters.date_from.trim())}")`);
  }
  if (filters.date_to?.trim()) {
    parts.push(`IS_BEFORE({timestamp}, "${escapeFormulaString(filters.date_to.trim())}")`);
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return `AND(${parts.join(", ")})`;
}

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getSpotChecks(filters: SpotCheckFilters = {}): Promise<MarketingSpotCheck[]> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).getSpotChecks(filters);
  const filterByFormula = buildSpotCheckFilter(filters);
  const records = await listAllRecords<SpotCheckFields>(TABLE_SPOT_CHECKS, {
    ...(filterByFormula ? { filterByFormula } : {}),
    sort: [{ field: "timestamp", direction: "desc" }],
  });
  return records.map(mapSpotCheck);
}

export async function getSpotCheckById(id: string): Promise<MarketingSpotCheck | null> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).getSpotCheckById(id);
  const rec = await getRecord<SpotCheckFields>(TABLE_SPOT_CHECKS, id);
  return rec ? mapSpotCheck(rec) : null;
}

export async function createSpotCheck(
  data: Partial<MarketingSpotCheck> & { manager_name: string },
): Promise<MarketingSpotCheck> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).createSpotCheck(data);
  const now = new Date().toISOString();
  const subject =
    data.subject?.trim() ||
    `${data.type ?? "Spot check"} — ${data.exec_va_name || data.creator_name || "Review"}`;
  const rec = await createRecord<SpotCheckFields>(TABLE_SPOT_CHECKS, {
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
    status: data.status ?? "Pending",
    ...(data.resolution_time != null ? { resolution_time: data.resolution_time } : {}),
  });
  const spotCheck = mapSpotCheck(rec);

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
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).updateSpotCheck(id, data);
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
  if (Object.keys(patch).length === 0) return;

  // Load prior state so we can detect a status transition into a terminal state and
  // notify the original submitter (manager_id) exactly once per transition.
  const before = data.status !== undefined ? await getSpotCheckById(id) : null;
  await updateRecord(TABLE_SPOT_CHECKS, id, patch);

  if (
    before &&
    data.status !== undefined &&
    data.status !== before.status &&
    (data.status === "Fixed" || data.status === "Escalated") &&
    before.manager_id
  ) {
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
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).deleteSpotCheck(id);
  await deleteRecord(TABLE_SPOT_CHECKS, id);
}

export async function uploadSpotCheckAttachments(
  id: string,
  files: Array<{ name: string; type: string; bytes: Uint8Array }>,
): Promise<void> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).uploadSpotCheckAttachments(id, files);
  for (const file of files) {
    if (!file.bytes.byteLength) continue;
    await uploadAirtableAttachment({
      recordId: id,
      fieldName: "attachments",
      filename: file.name || "attachment",
      contentType: file.type || "application/octet-stream",
      bytes: file.bytes,
    });
  }
}

export async function getDailyReviews(): Promise<MarketingDailyReview[]> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).getDailyReviews();
  const records = await listAllRecords<DailyReviewFields>(TABLE_DAILY_REVIEWS, {
    sort: [{ field: "review_date", direction: "desc" }],
  });
  return records.map(mapDailyReview);
}

export async function getDailyReviewByDate(date: string): Promise<MarketingDailyReview | null> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).getDailyReviewByDate(date);
  const targetKey = toReviewDateKey(date);
  if (!targetKey) return null;
  // Airtable filterByFormula string equality on date fields is unreliable (date⇄text
  // coercion against the base's European D/M/YYYY display format), so fetch all reviews
  // and match on a normalized YYYY-MM-DD key in JS instead. Volume is small.
  const records = await listAllRecords<DailyReviewFields>(TABLE_DAILY_REVIEWS, {
    sort: [{ field: "review_date", direction: "desc" }],
  });
  const match = records.find((rec) => toReviewDateKey(rec.fields?.review_date) === targetKey);
  return match ? mapDailyReview(match) : null;
}

export async function getDailyReviewDetail(id: string): Promise<MarketingDailyReviewDetail | null> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).getDailyReviewDetail(id);
  const rec = await getRecord<DailyReviewFields>(TABLE_DAILY_REVIEWS, id);
  if (!rec) return null;
  const review = mapDailyReview(rec);
  const execAudits = await getExecAuditsForDailyReview(id);
  return { ...review, exec_audits: execAudits };
}

async function getExecAuditsForDailyReview(dailyReviewId: string): Promise<MarketingExecAudit[]> {
  const rid = escapeFormulaString(dailyReviewId);
  const records = await listAllRecords<ExecAuditFields>(TABLE_EXEC_AUDITS, {
    filterByFormula: `FIND("${rid}", ARRAYJOIN({daily_review}) & "")`,
    sort: [{ field: "exec_va_name", direction: "asc" }],
  });
  return records.map(mapExecAudit);
}

export async function createDailyReview(
  data: Partial<MarketingDailyReview> & { manager_name: string; review_date: string },
): Promise<MarketingDailyReview> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).createDailyReview(data);
  // Guard against duplicate reviews for the same calendar day (defense-in-depth in case
  // the API-layer check is bypassed or a concurrent request slips through). Returns the
  // existing review instead of creating a second one.
  const existing = await getDailyReviewByDate(data.review_date);
  if (existing) return existing;

  const label =
    data.review_label?.trim() ||
    `Daily review — ${data.review_date}`;
  const rec = await createRecord<DailyReviewFields>(TABLE_DAILY_REVIEWS, {
    review_label: label,
    review_date: data.review_date,
    manager_name: data.manager_name,
    overall_kpis_reviewed: data.overall_kpis_reviewed ?? [],
    account_compliance_vs_master: data.account_compliance_vs_master ?? [],
    top_performer_id: data.top_performer_id ?? "",
    top_performer_name: data.top_performer_name ?? "",
    issues_found: data.issues_found ?? "",
    actions_assigned: data.actions_assigned ?? "",
    ...(data.time_spent_minutes != null ? { time_spent_minutes: data.time_spent_minutes } : {}),
  });
  return mapDailyReview(rec);
}

export async function updateDailyReview(id: string, data: Partial<MarketingDailyReview>): Promise<void> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).updateDailyReview(id, data);
  const patch: Record<string, unknown> = {};
  if (data.review_label !== undefined) patch.review_label = data.review_label;
  if (data.review_date !== undefined) patch.review_date = data.review_date;
  if (data.overall_kpis_reviewed !== undefined) patch.overall_kpis_reviewed = data.overall_kpis_reviewed;
  if (data.account_compliance_vs_master !== undefined) {
    patch.account_compliance_vs_master = data.account_compliance_vs_master;
  }
  if (data.top_performer_id !== undefined) patch.top_performer_id = data.top_performer_id;
  if (data.top_performer_name !== undefined) patch.top_performer_name = data.top_performer_name;
  if (data.issues_found !== undefined) patch.issues_found = data.issues_found;
  if (data.actions_assigned !== undefined) patch.actions_assigned = data.actions_assigned;
  if (data.time_spent_minutes !== undefined) patch.time_spent_minutes = data.time_spent_minutes;
  if (Object.keys(patch).length === 0) return;
  await updateRecord(TABLE_DAILY_REVIEWS, id, patch);
}

export async function uploadDailyReviewAttachments(
  id: string,
  files: Array<{ name: string; type: string; bytes: Uint8Array }>,
): Promise<void> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).uploadDailyReviewAttachments(id, files);
  for (const file of files) {
    if (!file.bytes.byteLength) continue;
    await uploadAirtableAttachment({
      recordId: id,
      fieldName: "attachments",
      filename: file.name || "attachment",
      contentType: file.type || "application/octet-stream",
      bytes: file.bytes,
    });
  }
}

export async function deleteDailyReview(id: string): Promise<void> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).deleteDailyReview(id);
  const audits = await getExecAuditsForDailyReview(id);
  for (const audit of audits) {
    await deleteRecord(TABLE_EXEC_AUDITS, audit.id);
  }
  await deleteRecord(TABLE_DAILY_REVIEWS, id);
}

export async function deleteExecAudit(id: string): Promise<void> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).deleteExecAudit(id);
  await deleteRecord(TABLE_EXEC_AUDITS, id);
}

export async function createExecAudit(
  data: Partial<MarketingExecAudit> & { daily_review_id: string },
): Promise<MarketingExecAudit> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).createExecAudit(data);
  const label =
    data.audit_label?.trim() ||
    `Exec audit — ${data.exec_va_name || "VA"} — ${data.reviewing_day || todayIsoDate()}`;
  const rec = await createRecord<ExecAuditFields>(TABLE_EXEC_AUDITS, {
    audit_label: label,
    daily_review: toLinkedRecordPayload(data.daily_review_id),
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
  return mapExecAudit(rec);
}

export async function updateExecAudit(id: string, data: Partial<MarketingExecAudit>): Promise<void> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).updateExecAudit(id, data);
  const patch: Record<string, unknown> = {};
  if (data.audit_label !== undefined) patch.audit_label = data.audit_label;
  if (data.daily_review_id !== undefined) {
    patch.daily_review = toLinkedRecordPayload(data.daily_review_id);
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
  await updateRecord(TABLE_EXEC_AUDITS, id, patch);
}

export async function getExecAuditsForVA(vaId: string): Promise<MarketingExecAudit[]> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).getExecAuditsForVA(vaId);
  const vid = escapeFormulaString(vaId.trim());
  const records = await listAllRecords<ExecAuditFields>(TABLE_EXEC_AUDITS, {
    filterByFormula: `{exec_va_id} = "${vid}"`,
    sort: [{ field: "reviewing_day", direction: "desc" }],
  });
  return records.map(mapExecAudit);
}

export async function getVaReviewHistory(vaId: string): Promise<VaReviewHistorySummary> {
  if (isSupabaseBackend()) return (await import("./marketing-reviews-supabase")).getVaReviewHistory(vaId);
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
