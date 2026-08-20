/**
 * Winner Video sourcing service (Supabase-only).
 * Distinct from Research `winner_videos` — feeds Creative Scripts by spawning
 * Approved + Needs Script rows on `winner_videos` when slots are assigned.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { coerceScriptStatus, type ScriptStatus } from "@/lib/creative-scripts-helpers";
import { coerceEditingStatus } from "@/lib/editing-helpers";
import { coerceFilmingStatus } from "@/lib/filming-helpers";
import { coerceIcloudStatus } from "@/lib/icloud-helpers";
import {
  DEFAULT_MODEL_WINNER_THRESHOLDS,
  SUPER_WINNER_RECREATE_COUNT_SETTING_KEY,
  TIER_RECREATE_COUNTS,
  WINNER_RECREATE_COUNT_SETTING_KEY,
  coerceBunchStatus,
  coerceSlotSource,
  coerceSlotVideoType,
  coerceWinnerSubmissionStatus,
  coerceWinnerTier,
  mapSlotTypeToScriptFields,
  mapScriptFieldsToSlotType,
  parsePositiveInt,
  resolveWinnerSubmissionSource,
  slotFilled,
  tierFromViewCount,
  type BunchStatus,
  type SlotSource,
  type SlotVideoType,
  type WinnerSourcingRecreateConfig,
  type WinnerSubmissionSource,
  type WinnerSubmissionStatus,
  type WinnerTier,
} from "@/lib/winner-sourcing-helpers";
import { createWinnerVideoRow, updateWinnerVideoFields } from "@/services/winner-videos-supabase";
import type { WinnerVideoRecord } from "@/services/winner-videos";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { listUsersWithPermission } from "@/services/users";
import { PERMISSIONS } from "@/lib/permissions";
import { getSystemSetting, setSystemSetting } from "@/services/system-settings";

export type { WinnerSourcingRecreateConfig };

// ── Types ────────────────────────────────────────────────────────────────────

export type VideoBunch = {
  id: string;
  name: string;
  model_id: string;
  model_name: string;
  target_video_count: number;
  created_by_id: string;
  created_by_name: string;
  status: BunchStatus;
  /** Source of truth: creative who scripts all slots in this bunch. */
  assigned_creative_id: string;
  assigned_creative_name: string;
  /** Filmer assigned after all scripts are approved. */
  assigned_filmer_id: string;
  assigned_filmer_name: string;
  filming_status: import("@/lib/filming-helpers").FilmingStatus;
  upload_folder_link: string;
  uploaded_at: string | null;
  /** Editor assigned after filming upload. */
  assigned_editor_id: string;
  assigned_editor_name: string;
  editing_status: import("@/lib/editing-helpers").EditingStatus;
  edited_upload_folder_link: string;
  edited_uploaded_at: string | null;
  /** iCloud org after editing upload (no per-bunch assignee). */
  icloud_status: import("@/lib/icloud-helpers").IcloudStatus;
  icloud_organized_at: string | null;
  created_at: string;
  updated_at: string;
  /** Computed: recreate_video_slots currently in this bunch (approved/filled). */
  provided_count?: number;
  /** Computed: Pending Research finds awaiting approve/reject for this bunch. */
  pending_review_count?: number;
  /** Computed: target − provided − pending. */
  remaining_count?: number;
  /** Computed filming progress when slots are loaded. */
  filmed_count?: number;
  filmable_count?: number;
  /** Computed editing progress when slots are loaded. */
  edited_count?: number;
  editable_count?: number;
};

export type WinnerSubmission = {
  id: string;
  model_id: string;
  model_name: string;
  submitted_by_id: string;
  submitted_by_name: string;
  video_link: string;
  view_count: number;
  tier: WinnerTier;
  status: WinnerSubmissionStatus;
  created_at: string;
  /**
   * Origin of the find. Optional until auto-detection migration lands —
   * UI resolves via resolveWinnerSubmissionSource when missing.
   */
  source: WinnerSubmissionSource;
  /** Optional caption / notes from auto-detection or submit form. */
  caption: string;
  /** Optional media thumbnail URL when provided by ClarioSuite / IG sync. */
  thumbnail_url: string;
  /** Instagram post date when known; falls back to created_at in UI. */
  posted_at: string | null;
  clariosuite_media_id: string | null;
  auto_classified_at: string | null;
  threshold_at_classification: {
    winner: number;
    super_winner: number;
  } | null;
  winner_threshold_at_classification: number | null;
  super_winner_threshold_at_classification: number | null;
};

export type RecreationQueueItem = {
  id: string;
  winner_submission_id: string;
  bunch_id: string | null;
  required_recreate_count: number;
  created_at: string;
  submission?: WinnerSubmission;
  bunch_name?: string;
};

export type RecreateVideoSlot = {
  id: string;
  bunch_id: string;
  source: SlotSource;
  sequence_number: number;
  description: string;
  admin_instructions: string;
  video_link: string;
  video_type: SlotVideoType | "";
  video_type_other: string;
  status: ScriptStatus;
  assigned_creative_id: string;
  assigned_creative_name: string;
  winner_submission_id: string | null;
  winner_video_id: string | null;
  filmed: boolean;
  filmed_at: string | null;
  edited: boolean;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
};

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapBunch(row: Record<string, unknown>): VideoBunch {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    model_id: String(row.model_id ?? ""),
    model_name: String(row.model_name ?? ""),
    target_video_count: Number(row.target_video_count) || 30,
    created_by_id: String(row.created_by_id ?? ""),
    created_by_name: String(row.created_by_name ?? ""),
    status: coerceBunchStatus(row.status),
    assigned_creative_id: String(row.assigned_creative_id ?? ""),
    assigned_creative_name: String(row.assigned_creative_name ?? ""),
    assigned_filmer_id: String(row.assigned_filmer_id ?? ""),
    assigned_filmer_name: String(row.assigned_filmer_name ?? ""),
    filming_status: coerceFilmingStatus(row.filming_status),
    upload_folder_link: String(row.upload_folder_link ?? ""),
    uploaded_at: row.uploaded_at ? String(row.uploaded_at) : null,
    assigned_editor_id: String(row.assigned_editor_id ?? ""),
    assigned_editor_name: String(row.assigned_editor_name ?? ""),
    editing_status: coerceEditingStatus(row.editing_status),
    edited_upload_folder_link: String(row.edited_upload_folder_link ?? ""),
    edited_uploaded_at: row.edited_uploaded_at ? String(row.edited_uploaded_at) : null,
    icloud_status: coerceIcloudStatus(row.icloud_status),
    icloud_organized_at: row.icloud_organized_at ? String(row.icloud_organized_at) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** Slots that pick up a new bunch creative on reassignment (not yet script-submitted). */
export function slotInheritsBunchCreative(status: ScriptStatus): boolean {
  return status === "Not Applicable" || status === "Needs Script";
}

function mapThresholdSnapshot(row: Record<string, unknown>): {
  winner: number;
  super_winner: number;
} | null {
  const raw = row.threshold_at_classification;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const winner = Number(obj.winner ?? obj.winner_threshold_views);
    const superWinner = Number(obj.super_winner ?? obj.super_winner_threshold_views);
    if (Number.isFinite(winner) && Number.isFinite(superWinner)) {
      return { winner, super_winner: superWinner };
    }
  }
  const w = row.winner_threshold_at_classification;
  const s = row.super_winner_threshold_at_classification;
  if (w != null && s != null && Number.isFinite(Number(w)) && Number.isFinite(Number(s))) {
    return { winner: Number(w), super_winner: Number(s) };
  }
  return null;
}

function mapSubmission(row: Record<string, unknown>): WinnerSubmission {
  const tier = coerceWinnerTier(row.tier) ?? "winner";
  const submittedById = String(row.submitted_by_id ?? "");
  const submittedByName = String(row.submitted_by_name ?? "");
  const snapshot = mapThresholdSnapshot(row);
  return {
    id: String(row.id),
    model_id: String(row.model_id ?? ""),
    model_name: String(row.model_name ?? ""),
    submitted_by_id: submittedById,
    submitted_by_name: submittedByName,
    video_link: String(row.video_link ?? ""),
    view_count: Number(row.view_count) || 0,
    tier,
    status: coerceWinnerSubmissionStatus(row.status),
    created_at: String(row.created_at ?? ""),
    source: resolveWinnerSubmissionSource({
      source: row.source ?? row.detection_source ?? row.submission_source,
      submitted_by_id: submittedById,
      submitted_by_name: submittedByName,
    }),
    caption: String(row.caption ?? row.notes ?? row.description ?? "").trim(),
    thumbnail_url: String(row.thumbnail_url ?? row.thumb_url ?? row.cover_url ?? "").trim(),
    posted_at: row.posted_at
      ? String(row.posted_at)
      : row.instagram_posted_at
        ? String(row.instagram_posted_at)
        : null,
    clariosuite_media_id: row.clariosuite_media_id
      ? String(row.clariosuite_media_id)
      : null,
    auto_classified_at: row.auto_classified_at ? String(row.auto_classified_at) : null,
    threshold_at_classification: snapshot,
    winner_threshold_at_classification:
      row.winner_threshold_at_classification != null
        ? Number(row.winner_threshold_at_classification)
        : snapshot?.winner ?? null,
    super_winner_threshold_at_classification:
      row.super_winner_threshold_at_classification != null
        ? Number(row.super_winner_threshold_at_classification)
        : snapshot?.super_winner ?? null,
  };
}

function mapQueueItem(row: Record<string, unknown>): RecreationQueueItem {
  return {
    id: String(row.id),
    winner_submission_id: String(row.winner_submission_id),
    bunch_id: row.bunch_id ? String(row.bunch_id) : null,
    required_recreate_count: Number(row.required_recreate_count) || 0,
    created_at: String(row.created_at ?? ""),
  };
}

function mapSlot(row: Record<string, unknown>): RecreateVideoSlot {
  return {
    id: String(row.id),
    bunch_id: String(row.bunch_id),
    source: coerceSlotSource(row.source),
    sequence_number: Number(row.sequence_number) || 1,
    description: String(row.description ?? ""),
    admin_instructions: String(row.admin_instructions ?? ""),
    video_link: String(row.video_link ?? ""),
    video_type: coerceSlotVideoType(row.video_type),
    video_type_other: String(row.video_type_other ?? ""),
    status: coerceScriptStatus(row.status),
    assigned_creative_id: String(row.assigned_creative_id ?? ""),
    assigned_creative_name: String(row.assigned_creative_name ?? ""),
    winner_submission_id: row.winner_submission_id ? String(row.winner_submission_id) : null,
    winner_video_id: row.winner_video_id ? String(row.winner_video_id) : null,
    filmed: Boolean(row.filmed),
    filmed_at: row.filmed_at ? String(row.filmed_at) : null,
    edited: Boolean(row.edited),
    edited_at: row.edited_at ? String(row.edited_at) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

// ── Submissions (ME FAB) ─────────────────────────────────────────────────────

export async function createWinnerSubmission(input: {
  model_id: string;
  model_name: string;
  video_link: string;
  view_count: number;
  submitted_by_id: string;
  submitted_by_name: string;
  source?: WinnerSubmissionSource;
  clariosuite_media_id?: string | null;
  thumbnail_url?: string;
  caption?: string;
  posted_at?: string | null;
  thresholds?: {
    winner_threshold_views: number;
    super_winner_threshold_views: number;
  } | null;
  skipNotify?: boolean;
}): Promise<WinnerSubmission> {
  const viewCount = Math.round(Number(input.view_count));
  let thresholds = input.thresholds ?? null;
  if (!thresholds) {
    try {
      const { getModelWinnerThresholds } = await import("./model-winner-thresholds");
      thresholds = await getModelWinnerThresholds(input.model_id);
    } catch {
      thresholds = null;
    }
  }
  const tier = tierFromViewCount(viewCount, thresholds);
  if (!tier) {
    const min =
      thresholds?.winner_threshold_views ??
      DEFAULT_MODEL_WINNER_THRESHOLDS.winner_threshold_views;
    throw new Error(`View count must be at least ${min.toLocaleString()} (got ${viewCount})`);
  }
  const link = input.video_link.trim();
  if (!link) throw new Error("Video link is required");
  const modelId = input.model_id.trim();
  if (!modelId) throw new Error("Model is required");

  const source =
    resolveWinnerSubmissionSource({
      source: input.source,
      submitted_by_id: input.submitted_by_id,
      submitted_by_name: input.submitted_by_name,
    }) ?? "va_submitted";

  const winnerThreshold =
    thresholds?.winner_threshold_views ??
    DEFAULT_MODEL_WINNER_THRESHOLDS.winner_threshold_views;
  const superThreshold =
    thresholds?.super_winner_threshold_views ??
    DEFAULT_MODEL_WINNER_THRESHOLDS.super_winner_threshold_views;
  const now = new Date().toISOString();
  const mediaId = input.clariosuite_media_id?.trim() || null;

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("winner_submissions")
    .insert({
      model_id: modelId,
      model_name: input.model_name.trim() || "Creator",
      submitted_by_id: input.submitted_by_id.trim(),
      submitted_by_name: input.submitted_by_name.trim(),
      video_link: link,
      view_count: viewCount,
      tier,
      status: "pending",
      source,
      clariosuite_media_id: mediaId,
      thumbnail_url: (input.thumbnail_url ?? "").trim(),
      caption: (input.caption ?? "").trim(),
      posted_at: input.posted_at || null,
      auto_classified_at: source === "auto_detected" ? now : null,
      threshold_at_classification: {
        winner: winnerThreshold,
        super_winner: superThreshold,
      },
      winner_threshold_at_classification: winnerThreshold,
      super_winner_threshold_at_classification: superThreshold,
    })
    .select("*")
    .single();

  if (error) throw new Error(`createWinnerSubmission: ${error.message}`);
  const submission = mapSubmission(data as Record<string, unknown>);

  if (!input.skipNotify) {
    const holders = await listUsersWithPermission(PERMISSIONS.WINNER_SOURCING_MANAGE).catch(
      () => [],
    );
    const autoLabel = source === "auto_detected" ? " (auto-detected)" : "";
    for (const u of holders) {
      if (!u.id || u.id === input.submitted_by_id) continue;
      await notify({
        user_id: u.id,
        event_type: NOTIFICATION_EVENT.WINNER_VIDEO_SUBMITTED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: `${tier === "super_winner" ? "🔥 Super Winner" : "🏆 Winner"}${autoLabel}`,
        body:
          source === "auto_detected"
            ? `${submission.model_name} hit ${viewCount.toLocaleString()} views — classified as ${tier === "super_winner" ? "Super Winner" : "Winner"}.`
            : `${submission.submitted_by_name} submitted a ${tier === "super_winner" ? "Super Winner" : "Winner"} for ${submission.model_name} (${viewCount.toLocaleString()} views).`,
        entity_type: NOTIFICATION_ENTITY.WINNER_VIDEO,
        entity_id: submission.id,
        actor_user_id: input.submitted_by_id,
        _triggerSource:
          source === "auto_detected" ? "winner_auto_detect" : "winner_sourcing_submit",
      }).catch(() => {});
    }
  }

  return submission;
}

export async function listWinnerSubmissions(filters?: {
  tier?: WinnerTier;
  status?: WinnerSubmissionStatus;
}): Promise<WinnerSubmission[]> {
  const sb = getSupabaseServiceClient();
  let q = sb.from("winner_submissions").select("*").order("created_at", { ascending: false });
  if (filters?.tier) q = q.eq("tier", filters.tier);
  if (filters?.status) q = q.eq("status", filters.status);
  const { data, error } = await q;
  if (error) throw new Error(`listWinnerSubmissions: ${error.message}`);
  return (data ?? []).map((r) => mapSubmission(r as Record<string, unknown>));
}

export async function getWinnerSubmission(id: string): Promise<WinnerSubmission | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from("winner_submissions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getWinnerSubmission: ${error.message}`);
  return data ? mapSubmission(data as Record<string, unknown>) : null;
}

export type WinnerSubmissionDeleteImpact = {
  submission_id: string;
  model_name: string;
  tier: WinnerTier;
  video_link: string;
  status: WinnerSubmissionStatus;
  source: WinnerSubmissionSource;
  recreation_queue_items: number;
  assigned_to_bunch: boolean;
  bunch_id: string | null;
  bunch_name: string;
  recreate_video_slots: number;
  winner_videos: number;
  filming_filmed_slots: number;
  filming_edited_slots: number;
  scripts_with_progress: number;
  /**
   * True when unassigned/pending (or queued only) with no recreate slots —
   * UI can use a simple confirm.
   */
  is_simple_delete: boolean;
  /**
   * True when slots have scripts/filming/editing progress — UI should require
   * typing the model name (same pattern as bunch delete with valuable work).
   */
  has_valuable_work: boolean;
  valuable_work_reasons: string[];
};

/** Preview cascade before permanently deleting a Winner / Super Winner submission. */
export async function getWinnerSubmissionDeleteImpact(
  submissionId: string,
): Promise<WinnerSubmissionDeleteImpact | null> {
  const submission = await getWinnerSubmission(submissionId);
  if (!submission) return null;

  const sb = getSupabaseServiceClient();
  const [{ data: queueRows }, { data: slotRows }] = await Promise.all([
    sb
      .from("recreation_queue_items")
      .select("id, bunch_id")
      .eq("winner_submission_id", submissionId),
    sb
      .from("recreate_video_slots")
      .select("id, status, filmed, edited, winner_video_id, bunch_id")
      .eq("winner_submission_id", submissionId),
  ]);

  const queue = (queueRows ?? []) as Array<{ id: string; bunch_id?: string | null }>;
  const slots = (slotRows ?? []) as Array<{
    id: string;
    status?: string;
    filmed?: boolean;
    edited?: boolean;
    winner_video_id?: string | null;
    bunch_id?: string;
  }>;

  const assignedQueue = queue.find((q) => Boolean(q.bunch_id?.trim()));
  const bunchId = assignedQueue?.bunch_id?.trim() || slots[0]?.bunch_id?.trim() || null;
  let bunchName = "";
  if (bunchId) {
    const bunch = await getVideoBunch(bunchId);
    bunchName = bunch?.name ?? "";
  }

  const filming_filmed_slots = slots.filter((s) => Boolean(s.filmed)).length;
  const filming_edited_slots = slots.filter((s) => Boolean(s.edited)).length;
  const scripts_with_progress = slots.filter((s) => {
    const st = String(s.status ?? "");
    return st === "Pending Review" || st === "Approved" || st === "Rejected";
  }).length;
  const winnerVideoIds = [
    ...new Set(
      slots
        .map((s) => String(s.winner_video_id ?? "").trim())
        .filter(Boolean),
    ),
  ];

  const valuable_work_reasons: string[] = [];
  if (scripts_with_progress > 0) {
    valuable_work_reasons.push(
      `${scripts_with_progress} script${scripts_with_progress === 1 ? "" : "s"} already written/reviewed`,
    );
  }
  if (filming_filmed_slots > 0) {
    valuable_work_reasons.push(
      `${filming_filmed_slots} slot${filming_filmed_slots === 1 ? "" : "s"} marked filmed`,
    );
  }
  if (filming_edited_slots > 0) {
    valuable_work_reasons.push(
      `${filming_edited_slots} slot${filming_edited_slots === 1 ? "" : "s"} marked edited`,
    );
  }
  if (winnerVideoIds.length > 0 && scripts_with_progress === 0) {
    valuable_work_reasons.push(
      `${winnerVideoIds.length} Creative Scripts work item${winnerVideoIds.length === 1 ? "" : "s"} linked`,
    );
  }

  const assigned_to_bunch = Boolean(bunchId);
  const recreate_video_slots = slots.length;
  const is_simple_delete =
    !assigned_to_bunch && recreate_video_slots === 0 && winnerVideoIds.length === 0;

  return {
    submission_id: submission.id,
    model_name: submission.model_name,
    tier: submission.tier,
    video_link: submission.video_link,
    status: submission.status,
    source: submission.source,
    recreation_queue_items: queue.length,
    assigned_to_bunch,
    bunch_id: bunchId,
    bunch_name: bunchName,
    recreate_video_slots,
    winner_videos: winnerVideoIds.length,
    filming_filmed_slots,
    filming_edited_slots,
    scripts_with_progress,
    is_simple_delete,
    has_valuable_work: valuable_work_reasons.length > 0,
    valuable_work_reasons,
  };
}

export function formatWinnerSubmissionDeleteDescription(
  impact: WinnerSubmissionDeleteImpact | null,
  loading: boolean,
): string {
  if (loading || !impact) return "Checking linked records…";
  const tierLabel = impact.tier === "super_winner" ? "Super Winner" : "Winner";
  const who = impact.model_name.trim() || "this model";

  if (impact.is_simple_delete) {
    return `Permanently delete this ${tierLabel} entry for ${who}? This cannot be undone.`;
  }

  const lines: string[] = [];
  if (impact.recreation_queue_items > 0) {
    lines.push(
      `${impact.recreation_queue_items} recreation queue item${impact.recreation_queue_items === 1 ? "" : "s"}`,
    );
  }
  if (impact.recreate_video_slots > 0) {
    lines.push(
      `${impact.recreate_video_slots} recreate slot${impact.recreate_video_slots === 1 ? "" : "s"}`,
    );
  }
  if (impact.winner_videos > 0) {
    lines.push(
      `${impact.winner_videos} Creative Scripts work item${impact.winner_videos === 1 ? "" : "s"}`,
    );
  }
  if (impact.filming_filmed_slots > 0) {
    lines.push(
      `${impact.filming_filmed_slots} filmed slot${impact.filming_filmed_slots === 1 ? "" : "s"}`,
    );
  }
  if (impact.filming_edited_slots > 0) {
    lines.push(
      `${impact.filming_edited_slots} edited slot${impact.filming_edited_slots === 1 ? "" : "s"}`,
    );
  }

  const bunchBit = impact.bunch_name
    ? ` assigned to bunch “${impact.bunch_name}”`
    : impact.assigned_to_bunch
      ? " assigned to a bunch"
      : "";

  let text = `This will permanently delete this ${tierLabel} for ${who}${bunchBit}`;
  if (lines.length) text += ` and remove: ${lines.join(", ")}`;
  text += ". Deleting cannot be undone.";
  if (impact.has_valuable_work) {
    text += ` Warning: this entry has valuable in-progress work (${impact.valuable_work_reasons.join("; ")}). Type the model name to confirm.`;
  }
  return text;
}

/**
 * Permanently delete a Winner / Super Winner submission and cascade linked
 * recreate slots + Creative Scripts rows. Queue items CASCADE from the
 * submission FK; slots only SET NULL so they are deleted explicitly.
 */
export async function deleteWinnerSubmission(
  submissionId: string,
): Promise<WinnerSubmissionDeleteImpact> {
  const impact = await getWinnerSubmissionDeleteImpact(submissionId);
  if (!impact) throw new Error("Submission not found");

  const sb = getSupabaseServiceClient();

  const { data: slotRows, error: slotSelectErr } = await sb
    .from("recreate_video_slots")
    .select("id, winner_video_id")
    .eq("winner_submission_id", submissionId);
  if (slotSelectErr) throw new Error(`list slots for delete: ${slotSelectErr.message}`);

  const slots = (slotRows ?? []) as Array<{ id: string; winner_video_id?: string | null }>;
  const winnerVideoIds = [
    ...new Set(
      slots
        .map((s) => String(s.winner_video_id ?? "").trim())
        .filter(Boolean),
    ),
  ];

  // 1) Slots first (FK would only SET NULL on submission delete).
  if (slots.length > 0) {
    const { error } = await sb
      .from("recreate_video_slots")
      .delete()
      .eq("winner_submission_id", submissionId);
    if (error) throw new Error(`delete recreate_video_slots: ${error.message}`);
  }

  // 2) Linked Creative Scripts / winner_videos rows spawned from those slots.
  if (winnerVideoIds.length > 0) {
    const { error } = await sb.from("winner_videos").delete().in("id", winnerVideoIds);
    if (error) throw new Error(`delete winner_videos: ${error.message}`);
  }

  // 3) Submission (recreation_queue_items CASCADE).
  {
    const { error } = await sb.from("winner_submissions").delete().eq("id", submissionId);
    if (error) throw new Error(`delete winner_submissions: ${error.message}`);
  }

  return impact;
}

// ── Recreate count settings (system_settings) ────────────────────────────────

export async function getWinnerSourcingRecreateConfig(): Promise<WinnerSourcingRecreateConfig> {
  const [winnerRaw, superRaw] = await Promise.all([
    getSystemSetting(WINNER_RECREATE_COUNT_SETTING_KEY).catch(() => null),
    getSystemSetting(SUPER_WINNER_RECREATE_COUNT_SETTING_KEY).catch(() => null),
  ]);
  return {
    winner_recreate_count: parsePositiveInt(
      winnerRaw,
      TIER_RECREATE_COUNTS.winner,
    ),
    super_winner_recreate_count: parsePositiveInt(
      superRaw,
      TIER_RECREATE_COUNTS.super_winner,
    ),
  };
}

export async function setWinnerSourcingRecreateConfig(input: {
  winner_recreate_count: number;
  super_winner_recreate_count: number;
}): Promise<WinnerSourcingRecreateConfig> {
  const winner = parsePositiveInt(input.winner_recreate_count, 0);
  const superWinner = parsePositiveInt(input.super_winner_recreate_count, 0);
  if (winner < 1) throw new Error("Winner recreate count must be at least 1");
  if (superWinner < 1) throw new Error("Super Winner recreate count must be at least 1");

  await Promise.all([
    setSystemSetting(
      WINNER_RECREATE_COUNT_SETTING_KEY,
      String(winner),
      "Recreate videos required when a Winner is added to the recreation queue",
    ),
    setSystemSetting(
      SUPER_WINNER_RECREATE_COUNT_SETTING_KEY,
      String(superWinner),
      "Recreate videos required when a Super Winner is added to the recreation queue",
    ),
  ]);

  return {
    winner_recreate_count: winner,
    super_winner_recreate_count: superWinner,
  };
}

function recreateCountForTier(
  tier: WinnerTier,
  config: WinnerSourcingRecreateConfig,
): number {
  return tier === "super_winner"
    ? config.super_winner_recreate_count
    : config.winner_recreate_count;
}

// ── Recreation queue ─────────────────────────────────────────────────────────

export async function addSubmissionToRecreationQueue(
  submissionId: string,
): Promise<RecreationQueueItem> {
  const submission = await getWinnerSubmission(submissionId);
  if (!submission) throw new Error("Submission not found");
  if (submission.status === "queued_for_recreation") {
    throw new Error("Already in recreation queue");
  }

  // Lock current settings into the queue item — later setting changes must not alter this.
  const config = await getWinnerSourcingRecreateConfig();
  const count = recreateCountForTier(submission.tier, config);
  const sb = getSupabaseServiceClient();

  const { data: item, error } = await sb
    .from("recreation_queue_items")
    .insert({
      winner_submission_id: submissionId,
      required_recreate_count: count,
    })
    .select("*")
    .single();
  if (error) throw new Error(`addSubmissionToRecreationQueue: ${error.message}`);

  const { error: upErr } = await sb
    .from("winner_submissions")
    .update({ status: "queued_for_recreation" })
    .eq("id", submissionId);
  if (upErr) throw new Error(`update submission status: ${upErr.message}`);

  return { ...mapQueueItem(item as Record<string, unknown>), submission };
}

export async function listRecreationQueue(): Promise<RecreationQueueItem[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("recreation_queue_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listRecreationQueue: ${error.message}`);

  const items = (data ?? []).map((r) => mapQueueItem(r as Record<string, unknown>));
  if (!items.length) return [];

  const subIds = [...new Set(items.map((i) => i.winner_submission_id))];
  const bunchIds = [...new Set(items.map((i) => i.bunch_id).filter(Boolean) as string[])];

  const [{ data: subs }, { data: bunches }] = await Promise.all([
    sb.from("winner_submissions").select("*").in("id", subIds),
    bunchIds.length
      ? sb.from("video_bunches").select("id, name").in("id", bunchIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const subMap = new Map(
    (subs ?? []).map((s) => [String((s as { id: string }).id), mapSubmission(s as Record<string, unknown>)]),
  );
  const bunchMap = new Map(
    (bunches ?? []).map((b) => [String((b as { id: string }).id), String((b as { name: string }).name)]),
  );

  return items.map((item) => ({
    ...item,
    submission: subMap.get(item.winner_submission_id),
    bunch_name: item.bunch_id ? bunchMap.get(item.bunch_id) : undefined,
  }));
}

/**
 * Assign a queued winner to a bunch and auto-spawn `required_recreate_count` slots
 * (source=from_winner) with the source video link prefilled.
 */
export async function assignQueueItemToBunch(
  queueItemId: string,
  bunchId: string,
): Promise<{ item: RecreationQueueItem; slots: RecreateVideoSlot[] }> {
  const sb = getSupabaseServiceClient();

  const { data: itemRow, error: itemErr } = await sb
    .from("recreation_queue_items")
    .select("*")
    .eq("id", queueItemId)
    .maybeSingle();
  if (itemErr) throw new Error(itemErr.message);
  if (!itemRow) throw new Error("Queue item not found");
  const item = mapQueueItem(itemRow as Record<string, unknown>);
  if (item.bunch_id) throw new Error("Already assigned to a bunch");

  const bunch = await getVideoBunch(bunchId);
  if (!bunch) throw new Error("Bunch not found");
  if (bunch.status !== "open") throw new Error("Bunch is closed");

  const remaining = await getBunchRemaining(bunchId);
  if (remaining < item.required_recreate_count) {
    throw new Error(
      `Bunch only has ${remaining} slots remaining; need ${item.required_recreate_count}`,
    );
  }

  const submission = await getWinnerSubmission(item.winner_submission_id);
  if (!submission) throw new Error("Submission not found");

  const { error: upErr } = await sb
    .from("recreation_queue_items")
    .update({ bunch_id: bunchId })
    .eq("id", queueItemId);
  if (upErr) throw new Error(upErr.message);

  const existingSlots = await listSlotsForBunch(bunchId);
  const startSeq = existingSlots.reduce((m, s) => Math.max(m, s.sequence_number), 0) + 1;
  const creativeId = bunch.assigned_creative_id.trim();
  const creativeName = bunch.assigned_creative_name.trim();

  const rows = Array.from({ length: item.required_recreate_count }, (_, i) => ({
    bunch_id: bunchId,
    source: "from_winner" as const,
    sequence_number: startSeq + i,
    description: `Recreate from ${submission.tier === "super_winner" ? "Super Winner" : "Winner"}: ${submission.video_link}`,
    video_link: submission.video_link,
    video_type: "",
    status: "Not Applicable",
    winner_submission_id: submission.id,
    // Inherit bunch creative (denormalized); scripts work items spawned below if present.
    assigned_creative_id: creativeId || null,
    assigned_creative_name: creativeName,
  }));

  const { data: slotRows, error: slotErr } = await sb
    .from("recreate_video_slots")
    .insert(rows)
    .select("*");
  if (slotErr) throw new Error(`spawn slots: ${slotErr.message}`);

  let slots = (slotRows ?? []).map((r) => mapSlot(r as Record<string, unknown>));

  // Auto-spawn Creative Scripts work items when the bunch already has a creative.
  if (creativeId && creativeName && slots.length > 0) {
    const spawned: RecreateVideoSlot[] = [];
    for (const slot of slots) {
      spawned.push(
        await assignCreativeToSlot({
          slot_id: slot.id,
          assigned_creative_id: creativeId,
          assigned_creative_name: creativeName,
          skip_notify: true,
        }),
      );
    }
    slots = spawned;
    await notify({
      user_id: creativeId,
      event_type: NOTIFICATION_EVENT.RESEARCH_ASSIGNED_TO_CREATIVE,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "🎬 New recreate bunch needs scripts",
      body: `${slots.length} recreate(s) in “${bunch.name}” were assigned to you.`,
      entity_type: NOTIFICATION_ENTITY.CREATIVE_SCRIPT,
      entity_id: slots[0]?.winner_video_id || bunchId,
      _triggerSource: "winner_sourcing_queue_inherit_bunch_creative",
    }).catch(() => {});
  }

  return {
    item: { ...item, bunch_id: bunchId, submission, bunch_name: bunch.name },
    slots,
  };
}

// ── Bunches ──────────────────────────────────────────────────────────────────

export async function createVideoBunch(input: {
  name: string;
  model_id: string;
  model_name: string;
  target_video_count: number;
  created_by_id: string;
  created_by_name: string;
}): Promise<VideoBunch> {
  const name = input.name.trim();
  if (!name) throw new Error("Bunch name is required");
  const target = Math.round(Number(input.target_video_count));
  if (!Number.isFinite(target) || target < 1) throw new Error("Target must be at least 1");

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("video_bunches")
    .insert({
      name,
      model_id: input.model_id.trim(),
      model_name: input.model_name.trim() || "Creator",
      target_video_count: target,
      created_by_id: input.created_by_id.trim(),
      created_by_name: input.created_by_name.trim(),
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw new Error(`createVideoBunch: ${error.message}`);
  return mapBunch(data as Record<string, unknown>);
}

export async function listVideoBunches(filters?: {
  status?: BunchStatus;
}): Promise<VideoBunch[]> {
  const sb = getSupabaseServiceClient();
  let q = sb.from("video_bunches").select("*").order("created_at", { ascending: false });
  if (filters?.status) q = q.eq("status", filters.status);
  const { data, error } = await q;
  if (error) throw new Error(`listVideoBunches: ${error.message}`);
  const bunches = (data ?? []).map((r) => mapBunch(r as Record<string, unknown>));
  if (!bunches.length) return [];

  const ids = bunches.map((b) => b.id);
  const [{ data: slots }, { data: pendingRows }] = await Promise.all([
    sb.from("recreate_video_slots").select("bunch_id, winner_video_id").in("bunch_id", ids),
    sb
      .from("winner_videos")
      .select("id, bunch_id")
      .in("bunch_id", ids)
      .eq("status", "Pending"),
  ]);
  const slotCounts = new Map<string, number>();
  const slottedWinnerVideoIds = new Set<string>();
  for (const s of slots ?? []) {
    const row = s as { bunch_id: string; winner_video_id?: string | null };
    const bid = String(row.bunch_id);
    slotCounts.set(bid, (slotCounts.get(bid) ?? 0) + 1);
    const wvId = String(row.winner_video_id ?? "").trim();
    if (wvId) slottedWinnerVideoIds.add(wvId);
  }
  const pendingCounts = new Map<string, number>();
  for (const p of pendingRows ?? []) {
    const row = p as { id: string; bunch_id: string };
    const bid = String(row.bunch_id);
    if (!bid) continue;
    if (slottedWinnerVideoIds.has(String(row.id))) continue;
    pendingCounts.set(bid, (pendingCounts.get(bid) ?? 0) + 1);
  }
  return bunches.map((b) => {
    const provided = slotCounts.get(b.id) ?? 0;
    const pending = pendingCounts.get(b.id) ?? 0;
    return {
      ...b,
      provided_count: provided,
      pending_review_count: pending,
      remaining_count: Math.max(0, b.target_video_count - provided - pending),
    };
  });
}

export async function getVideoBunch(id: string): Promise<VideoBunch | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from("video_bunches").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getVideoBunch: ${error.message}`);
  if (!data) return null;
  const bunch = mapBunch(data as Record<string, unknown>);
  const [provided, pending] = await Promise.all([
    countSlotsForBunch(id),
    countPendingReviewsForBunch(id),
  ]);
  return {
    ...bunch,
    provided_count: provided,
    pending_review_count: pending,
    remaining_count: Math.max(0, bunch.target_video_count - provided - pending),
  };
}

export async function updateVideoBunchStatus(
  id: string,
  status: BunchStatus,
): Promise<VideoBunch> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("video_bunches")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`updateVideoBunchStatus: ${error.message}`);
  return mapBunch(data as Record<string, unknown>);
}

export type VideoBunchDeleteImpact = {
  bunch_id: string;
  bunch_name: string;
  recreate_video_slots: number;
  winner_videos: number;
  filming_filmed_slots: number;
  filming_edited_slots: number;
  icloud_folder_entries: number;
  recreation_queue_items: number;
  /** Scripts past Needs Script / Not Applicable (written or reviewed). */
  scripts_with_progress: number;
  /**
   * True when the bunch has in-progress valuable work (scripts written, filming/editing done,
   * or pipeline already past sourcing). UI should require a stronger confirm.
   */
  has_valuable_work: boolean;
  valuable_work_reasons: string[];
};

async function countEq(table: string, col: string, value: string): Promise<number> {
  const sb = getSupabaseServiceClient();
  const { count, error } = await sb
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(col, value);
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
}

/** Preview cascade counts before permanently deleting a video bunch. */
export async function getVideoBunchDeleteImpact(
  bunchId: string,
): Promise<VideoBunchDeleteImpact | null> {
  const sb = getSupabaseServiceClient();
  const { data: row, error } = await sb
    .from("video_bunches")
    .select("id, name, filming_status, editing_status, icloud_status, uploaded_at, edited_uploaded_at")
    .eq("id", bunchId)
    .maybeSingle();
  if (error) throw new Error(`getVideoBunchDeleteImpact: ${error.message}`);
  if (!row) return null;

  const [
    recreate_video_slots,
    winner_videos,
    icloud_folder_entries,
    recreation_queue_items,
    { data: slotRows },
  ] = await Promise.all([
    countEq("recreate_video_slots", "bunch_id", bunchId),
    countEq("winner_videos", "bunch_id", bunchId),
    countEq("icloud_folder_entries", "bunch_id", bunchId),
    countEq("recreation_queue_items", "bunch_id", bunchId),
    sb
      .from("recreate_video_slots")
      .select("status, filmed, edited")
      .eq("bunch_id", bunchId),
  ]);

  const slots = (slotRows ?? []) as Array<{
    status?: string;
    filmed?: boolean;
    edited?: boolean;
  }>;
  const filming_filmed_slots = slots.filter((s) => Boolean(s.filmed)).length;
  const filming_edited_slots = slots.filter((s) => Boolean(s.edited)).length;
  const scripts_with_progress = slots.filter((s) => {
    const st = String(s.status ?? "");
    return st === "Pending Review" || st === "Approved" || st === "Rejected";
  }).length;

  const filmingStatus = coerceFilmingStatus(row.filming_status);
  const editingStatus = coerceEditingStatus(row.editing_status);
  const icloudStatus = coerceIcloudStatus(row.icloud_status);

  const valuable_work_reasons: string[] = [];
  if (scripts_with_progress > 0) {
    valuable_work_reasons.push(
      `${scripts_with_progress} script${scripts_with_progress === 1 ? "" : "s"} already written/reviewed`,
    );
  }
  if (filming_filmed_slots > 0 || filmingStatus === "uploaded" || row.uploaded_at) {
    valuable_work_reasons.push(
      filming_filmed_slots > 0
        ? `${filming_filmed_slots} slot${filming_filmed_slots === 1 ? "" : "s"} marked filmed`
        : "filming upload already recorded",
    );
  }
  if (filming_edited_slots > 0 || editingStatus === "uploaded" || row.edited_uploaded_at) {
    valuable_work_reasons.push(
      filming_edited_slots > 0
        ? `${filming_edited_slots} slot${filming_edited_slots === 1 ? "" : "s"} marked edited`
        : "editing upload already recorded",
    );
  }
  if (icloudStatus === "organized") {
    valuable_work_reasons.push("iCloud organization already complete");
  }

  return {
    bunch_id: String(row.id),
    bunch_name: String(row.name ?? ""),
    recreate_video_slots,
    winner_videos,
    filming_filmed_slots,
    filming_edited_slots,
    icloud_folder_entries,
    recreation_queue_items,
    scripts_with_progress,
    has_valuable_work: valuable_work_reasons.length > 0,
    valuable_work_reasons,
  };
}

/**
 * Permanently delete a video bunch and all linked pipeline rows.
 * Explicit deletes for tables with ON DELETE SET NULL so nothing is left orphaned.
 * `recreate_video_slots` / `icloud_folder_entries` also CASCADE from the bunch row.
 */
export async function deleteVideoBunch(bunchId: string): Promise<VideoBunchDeleteImpact> {
  const impact = await getVideoBunchDeleteImpact(bunchId);
  if (!impact) throw new Error("Bunch not found");

  const sb = getSupabaseServiceClient();

  // 1) Slots first (text link to winner_videos; no FK blocking).
  {
    const { error } = await sb.from("recreate_video_slots").delete().eq("bunch_id", bunchId);
    if (error) throw new Error(`delete recreate_video_slots: ${error.message}`);
  }
  // 2) Scripts / research finds linked to this bunch (FK would only SET NULL).
  {
    const { error } = await sb.from("winner_videos").delete().eq("bunch_id", bunchId);
    if (error) throw new Error(`delete winner_videos: ${error.message}`);
  }
  // 3) Queue items assigned to this bunch (FK would only SET NULL).
  {
    const { error } = await sb.from("recreation_queue_items").delete().eq("bunch_id", bunchId);
    if (error) throw new Error(`delete recreation_queue_items: ${error.message}`);
  }
  // 4) iCloud folders (also CASCADE, delete explicitly for clarity).
  {
    const { error } = await sb.from("icloud_folder_entries").delete().eq("bunch_id", bunchId);
    if (error) throw new Error(`delete icloud_folder_entries: ${error.message}`);
  }
  // 5) Bunch row.
  {
    const { error } = await sb.from("video_bunches").delete().eq("id", bunchId);
    if (error) throw new Error(`delete video_bunches: ${error.message}`);
  }

  return impact;
}

export type RecreateVideoSlotDeleteImpact = {
  slot_id: string;
  sequence_number: number;
  bunch_id: string;
  bunch_name: string;
  source: SlotSource;
  slot_status: ScriptStatus;
  filmed: boolean;
  edited: boolean;
  winner_video_id: string | null;
  /** Linked Creative Scripts row removed with the slot. */
  deletes_winner_video: boolean;
  creative_name: string;
  script_status: ScriptStatus | "";
  has_script_text: boolean;
  researcher_id: string;
  researcher_name: string;
  warning_lines: string[];
  has_valuable_work: boolean;
};

function scriptStatusHasProgress(status: ScriptStatus): boolean {
  return status === "Pending Review" || status === "Approved" || status === "Rejected";
}

/** Load recreate slot linked to a winner_videos row (Fill Bunches approve / Creative Scripts spawn). */
export async function getRecreateVideoSlotByWinnerVideoId(
  winnerVideoId: string,
): Promise<RecreateVideoSlot | null> {
  const id = winnerVideoId.trim();
  if (!id) return null;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("recreate_video_slots")
    .select("*")
    .eq("winner_video_id", id)
    .maybeSingle();
  if (error) throw new Error(`getRecreateVideoSlotByWinnerVideoId: ${error.message}`);
  return data ? mapSlot(data as Record<string, unknown>) : null;
}

/** Preview cascade before permanently deleting a single recreate slot. */
export async function getRecreateVideoSlotDeleteImpact(
  slotId: string,
): Promise<RecreateVideoSlotDeleteImpact | null> {
  const sb = getSupabaseServiceClient();
  const { data: slotRow, error: slotErr } = await sb
    .from("recreate_video_slots")
    .select("*")
    .eq("id", slotId)
    .maybeSingle();
  if (slotErr) throw new Error(`getRecreateVideoSlotDeleteImpact: ${slotErr.message}`);
  if (!slotRow) return null;

  const slot = mapSlot(slotRow as Record<string, unknown>);
  const bunch = await getVideoBunch(slot.bunch_id);

  let creativeName = slot.assigned_creative_name?.trim() || bunch?.assigned_creative_name?.trim() || "";
  let scriptStatus: ScriptStatus | "" = slot.status;
  let hasScriptText = false;
  let researcherId = "";
  let researcherName = "";
  const winnerVideoId = slot.winner_video_id?.trim() || null;

  if (winnerVideoId) {
    const { data: wvRow } = await sb
      .from("winner_videos")
      .select(
        "assigned_creative_name, script_status, script_text, submitted_by_id, submitted_by_name",
      )
      .eq("id", winnerVideoId)
      .maybeSingle();
    if (wvRow) {
      const wv = wvRow as Record<string, unknown>;
      creativeName =
        String(wv.assigned_creative_name ?? "").trim() ||
        creativeName;
      scriptStatus = coerceScriptStatus(wv.script_status) || slot.status;
      hasScriptText = Boolean(String(wv.script_text ?? "").trim());
      if (slot.source === "researcher_submitted") {
        researcherId = String(wv.submitted_by_id ?? "").trim();
        researcherName = String(wv.submitted_by_name ?? "").trim();
      }
    }
  }

  const warning_lines: string[] = [];
  if (winnerVideoId) {
    warning_lines.push("The linked Creative Scripts / research record will be permanently deleted.");
  }
  if (scriptStatus === "Approved" && creativeName) {
    warning_lines.push(`Approved script by ${creativeName} will be lost.`);
  } else if (scriptStatus === "Pending Review" && creativeName) {
    warning_lines.push(`Script submitted by ${creativeName} (pending review) will be lost.`);
  } else if (scriptStatus === "Rejected" && creativeName) {
    warning_lines.push(`Rejected script by ${creativeName} will be lost.`);
  } else if (scriptStatusHasProgress(scriptStatus)) {
    warning_lines.push("Script review progress on this slot will be lost.");
  } else if (creativeName && (scriptStatus === "Needs Script" || slot.status === "Needs Script")) {
    warning_lines.push(`Creative assignment to ${creativeName} on this slot will be cleared.`);
  }
  if (hasScriptText && scriptStatus !== "Approved") {
    warning_lines.push("Written script text on the linked record will be deleted.");
  }
  if (slot.filmed) {
    warning_lines.push("Filming progress (slot marked filmed) will be lost.");
  }
  if (slot.edited) {
    warning_lines.push("Editing progress (slot marked edited) will be lost.");
  }

  const has_valuable_work =
    slot.filmed ||
    slot.edited ||
    scriptStatusHasProgress(scriptStatus) ||
    hasScriptText ||
    Boolean(winnerVideoId);

  return {
    slot_id: slot.id,
    sequence_number: slot.sequence_number,
    bunch_id: slot.bunch_id,
    bunch_name: bunch?.name || "",
    source: slot.source,
    slot_status: slot.status,
    filmed: slot.filmed,
    edited: slot.edited,
    winner_video_id: winnerVideoId,
    deletes_winner_video: Boolean(winnerVideoId),
    creative_name: creativeName,
    script_status: scriptStatus,
    has_script_text: hasScriptText,
    researcher_id: researcherId,
    researcher_name: researcherName,
    warning_lines,
    has_valuable_work,
  };
}

export function formatRecreateVideoSlotDeleteDescription(
  impact: RecreateVideoSlotDeleteImpact | null,
  loading: boolean,
): string {
  if (loading || !impact) return "Checking linked records…";
  const slotLabel = `#${impact.sequence_number}`;
  const intro = `Remove slot ${slotLabel} from “${impact.bunch_name}”? The bunch filled count will decrease by 1 and researchers can submit a replacement find.`;
  if (impact.warning_lines.length === 0) {
    return `${intro} This cannot be undone.`;
  }
  return `${intro} You will also lose: ${impact.warning_lines.join(" ")} This cannot be undone.`;
}

/**
 * Permanently delete one recreate slot, optionally removing its linked winner_videos row.
 * Reopens the bunch slot for researcher replacement (provided_count drops automatically).
 */
export async function deleteRecreateVideoSlot(input: {
  slot_id: string;
  actor_user_id?: string;
  actor_user_name?: string;
}): Promise<RecreateVideoSlotDeleteImpact> {
  const impact = await getRecreateVideoSlotDeleteImpact(input.slot_id);
  if (!impact) throw new Error("Slot not found");

  const sb = getSupabaseServiceClient();

  {
    const { error } = await sb.from("recreate_video_slots").delete().eq("id", impact.slot_id);
    if (error) throw new Error(`delete recreate_video_slots: ${error.message}`);
  }

  if (impact.winner_video_id) {
    const { error } = await sb.from("winner_videos").delete().eq("id", impact.winner_video_id);
    if (error) throw new Error(`delete winner_videos: ${error.message}`);
  }

  if (
    impact.source === "researcher_submitted" &&
    impact.researcher_id &&
    impact.researcher_id !== "system"
  ) {
    const actorName = (input.actor_user_name || "Admin").trim();
    await notify({
      user_id: impact.researcher_id,
      event_type: NOTIFICATION_EVENT.RECREATE_VIDEO_SLOT_DELETED,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "Recreate slot removed — submit again",
      body: `${actorName} removed your approved find (slot ${impact.sequence_number}) from “${impact.bunch_name}”. You can submit a replacement in Fill Bunches.`,
      entity_type: NOTIFICATION_ENTITY.WINNER_VIDEO,
      entity_id: impact.bunch_id,
      actor_user_id: input.actor_user_id,
      _triggerSource: "recreate_video_slot_deleted",
    }).catch(() => {});
  }

  return impact;
}

async function countSlotsForBunch(bunchId: string): Promise<number> {
  const sb = getSupabaseServiceClient();
  const { count, error } = await sb
    .from("recreate_video_slots")
    .select("id", { count: "exact", head: true })
    .eq("bunch_id", bunchId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countPendingReviewsForBunch(bunchId: string): Promise<number> {
  const sb = getSupabaseServiceClient();
  const { data: pendingRows, error } = await sb
    .from("winner_videos")
    .select("id")
    .eq("bunch_id", bunchId)
    .eq("status", "Pending");
  if (error) throw new Error(error.message);
  if (!pendingRows?.length) return 0;

  const pendingIds = pendingRows.map((r) => String((r as { id: string }).id));
  const { data: slotted, error: slotErr } = await sb
    .from("recreate_video_slots")
    .select("winner_video_id")
    .in("winner_video_id", pendingIds);
  if (slotErr) throw new Error(slotErr.message);

  const slottedIds = new Set(
    (slotted ?? []).map((r) => String((r as { winner_video_id: string }).winner_video_id)),
  );
  return pendingIds.filter((id) => !slottedIds.has(id)).length;
}

export async function getBunchRemaining(bunchId: string): Promise<number> {
  const bunch = await getVideoBunch(bunchId);
  if (!bunch) return 0;
  return bunch.remaining_count ?? 0;
}

// ── Slots ────────────────────────────────────────────────────────────────────

export async function listSlotsForBunch(bunchId: string): Promise<RecreateVideoSlot[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("recreate_video_slots")
    .select("*")
    .eq("bunch_id", bunchId)
    .order("sequence_number", { ascending: true });
  if (error) throw new Error(`listSlotsForBunch: ${error.message}`);
  return (data ?? []).map((r) => mapSlot(r as Record<string, unknown>));
}

/**
 * Researcher Fill Bunches submit → Pending Research (winner_videos) row with bunch_id.
 * Does NOT create recreate_video_slots until admin Approves in Research Manage.
 */
export async function submitResearcherBunchFind(input: {
  bunch_id: string;
  description: string;
  video_link: string;
  video_type: SlotVideoType;
  video_type_other?: string;
  submitted_by_id: string;
  submitted_by_name: string;
  force_duplicate?: boolean;
}): Promise<WinnerVideoRecord> {
  const bunch = await getVideoBunch(input.bunch_id);
  if (!bunch) throw new Error("Bunch not found");
  if (bunch.status !== "open") throw new Error("Bunch is closed");
  const remaining = bunch.remaining_count ?? 0;
  if (remaining < 1) throw new Error("Bunch has no remaining capacity");

  const description = input.description.trim();
  const video_link = input.video_link.trim();
  if (!video_link) throw new Error("Video link is required");
  if (!input.video_type) throw new Error("Video type is required");
  const video_type_other =
    input.video_type === "other" ? String(input.video_type_other ?? "").trim() : "";
  if (input.video_type === "other" && !video_type_other) {
    throw new Error("Custom type text is required when Other is selected");
  }

  if (!input.force_duplicate && bunch.model_id?.trim()) {
    const { findDuplicateVideoLinkForModel } = await import("./winner-videos");
    const dup = await findDuplicateVideoLinkForModel({
      model_id: bunch.model_id,
      video_link,
    });
    if (dup) {
      const err = new Error(
        "This exact link was already submitted for this model. Submit anyway to override.",
      ) as Error & { code?: string; duplicate_id?: string };
      err.code = "DUPLICATE_LINK";
      err.duplicate_id = dup.id;
      throw err;
    }
  }

  const { content_type, script_video_type } = mapSlotTypeToScriptFields(input.video_type);

  const { createWinnerVideo } = await import("./winner-videos");
  return createWinnerVideo({
    reference_model_id: bunch.model_id || undefined,
    reference_model_name: bunch.model_name || "Creator",
    content_type,
    video_link,
    note: description,
    submitted_by_id: input.submitted_by_id,
    submitted_by_name: input.submitted_by_name,
    bunch_id: bunch.id,
    bunch_name: bunch.name,
    script_video_type,
    sourcing_video_type: input.video_type,
    video_type_other,
  });
}

/**
 * On Research Manage Approve of a Fill Bunches find: create recreate_video_slot in that bunch
 * and link it to the winner_videos row (Creative Scripts work item).
 * Creative assignment is inherited from the parent bunch (source of truth).
 */
export async function createSlotFromApprovedWinnerVideo(input: {
  winner_video: WinnerVideoRecord;
  /** @deprecated Prefer bunch.assigned_creative_*; used only as fallback when bunch has none. */
  assigned_creative_id?: string;
  assigned_creative_name?: string;
}): Promise<RecreateVideoSlot> {
  const wv = input.winner_video;
  const bunchId = wv.bunch_id?.trim();
  if (!bunchId) throw new Error("Winner video has no bunch_id");

  const sb = getSupabaseServiceClient();
  const bunch = await getVideoBunch(bunchId);
  if (!bunch) throw new Error("Bunch not found");

  const creativeId =
    bunch.assigned_creative_id.trim() || String(input.assigned_creative_id ?? "").trim();
  const creativeName =
    bunch.assigned_creative_name.trim() || String(input.assigned_creative_name ?? "").trim();
  const hasCreative = Boolean(creativeId && creativeName);

  const { data: existingSlot } = await sb
    .from("recreate_video_slots")
    .select("*")
    .eq("winner_video_id", wv.id)
    .maybeSingle();

  // Approve after assign (or re-approve): keep denormalized slot + Scripts queue in sync.
  if (existingSlot) {
    let slot = mapSlot(existingSlot as Record<string, unknown>);
    if (hasCreative && slotInheritsBunchCreative(slot.status)) {
      const { data: synced, error: syncErr } = await sb
        .from("recreate_video_slots")
        .update({
          assigned_creative_id: creativeId,
          assigned_creative_name: creativeName,
          status: "Needs Script",
          winner_video_id: wv.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", slot.id)
        .select("*")
        .single();
      if (syncErr) throw new Error(`createSlotFromApprovedWinnerVideo: ${syncErr.message}`);
      slot = mapSlot(synced as Record<string, unknown>);
      await updateWinnerVideoFields(wv.id, {
        assigned_creative_id: creativeId,
        assigned_creative_name: creativeName,
        script_status: "Needs Script",
        bunch_id: bunchId,
        bunch_name: bunch.name,
      }).catch(() => {});
    }
    return slot;
  }

  const video_type = mapScriptFieldsToSlotType(
    wv.content_type,
    wv.script_video_type,
    wv.sourcing_video_type,
  );
  const video_type_other =
    video_type === "other" ? String(wv.video_type_other ?? "").trim() : "";
  const existing = await listSlotsForBunch(bunchId);
  const nextSeq = existing.reduce((m, s) => Math.max(m, s.sequence_number), 0) + 1;

  const { data, error } = await sb
    .from("recreate_video_slots")
    .insert({
      bunch_id: bunchId,
      source: "researcher_submitted",
      sequence_number: nextSeq,
      description: wv.note || "",
      admin_instructions: String(wv.admin_instructions ?? "").trim(),
      video_link: wv.video_link || "",
      video_type,
      video_type_other,
      status: hasCreative ? "Needs Script" : "Not Applicable",
      assigned_creative_id: creativeId || null,
      assigned_creative_name: creativeName,
      winner_video_id: wv.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createSlotFromApprovedWinnerVideo: ${error.message}`);

  // Keep winner_videos creative in sync with bunch when inheriting (assign-before-approve).
  if (hasCreative) {
    await updateWinnerVideoFields(wv.id, {
      assigned_creative_id: creativeId,
      assigned_creative_name: creativeName,
      script_status: "Needs Script",
      bunch_id: bunchId,
      bunch_name: bunch.name,
    }).catch(() => {});
  }

  return mapSlot(data as Record<string, unknown>);
}

export async function updateSlotContent(
  slotId: string,
  patch: {
    description?: string;
    video_link?: string;
    video_type?: SlotVideoType | "";
    video_type_other?: string;
  },
): Promise<RecreateVideoSlot> {
  const sb = getSupabaseServiceClient();
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.description !== undefined) fields.description = patch.description.trim();
  if (patch.video_link !== undefined) fields.video_link = patch.video_link.trim();
  if (patch.video_type !== undefined) {
    fields.video_type = patch.video_type;
    if (patch.video_type === "other") {
      const other = String(patch.video_type_other ?? "").trim();
      if (!other) throw new Error("Custom type text is required when Other is selected");
      fields.video_type_other = other;
    } else if (patch.video_type) {
      fields.video_type_other = "";
    } else if (patch.video_type_other !== undefined) {
      fields.video_type_other = patch.video_type_other.trim();
    }
  } else if (patch.video_type_other !== undefined) {
    fields.video_type_other = patch.video_type_other.trim();
  }

  const { data, error } = await sb
    .from("recreate_video_slots")
    .update(fields)
    .eq("id", slotId)
    .select("*")
    .single();
  if (error) throw new Error(`updateSlotContent: ${error.message}`);

  const slot = mapSlot(data as Record<string, unknown>);
  // Keep linked winner_videos sourcing type in sync when admin edits from Hub.
  if (slot.winner_video_id && patch.video_type) {
    const { content_type, script_video_type } = mapSlotTypeToScriptFields(patch.video_type);
    await updateWinnerVideoFields(slot.winner_video_id, {
      sourcing_video_type: patch.video_type,
      video_type_other: slot.video_type_other,
      content_type,
      script_video_type,
    }).catch(() => {});
  }
  return slot;
}

/** Mirror admin type edit from Research Manage onto linked recreate_video_slots. */
export async function syncSlotVideoTypeForWinnerVideo(
  winnerVideoId: string,
  videoType: SlotVideoType,
  videoTypeOther = "",
): Promise<void> {
  const sb = getSupabaseServiceClient();
  const other = videoType === "other" ? videoTypeOther.trim() : "";
  await sb
    .from("recreate_video_slots")
    .update({
      video_type: videoType,
      video_type_other: other,
      updated_at: new Date().toISOString(),
    })
    .eq("winner_video_id", winnerVideoId);
}


/**
 * Assign a creative to a filled slot and spawn a Creative Scripts work item
 * on `winner_videos` (Approved + Needs Script) — same queue creatives already use.
 * Prefer `assignCreativeToBunch` for admin assignment; this is used internally
 * and for denormalized slot + winner_videos updates.
 */
export async function assignCreativeToSlot(input: {
  slot_id: string;
  assigned_creative_id: string;
  assigned_creative_name: string;
  assigned_creator_name?: string;
  actor_user_id?: string;
  actor_user_name?: string;
  /** Skip per-slot notify (e.g. when bunch assign sends one summary). */
  skip_notify?: boolean;
}): Promise<RecreateVideoSlot> {
  const sb = getSupabaseServiceClient();
  const { data: row, error } = await sb
    .from("recreate_video_slots")
    .select("*")
    .eq("id", input.slot_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Slot not found");

  let slot = mapSlot(row as Record<string, unknown>);
  if (!slotFilled(slot)) {
    throw new Error("Slot needs description and video link before assigning a creative");
  }
  if (!input.assigned_creative_id.trim()) throw new Error("Creative is required");

  const bunch = await getVideoBunch(slot.bunch_id);
  const creatorName =
    input.assigned_creator_name?.trim() || bunch?.model_name || "Creator";
  const { content_type, script_video_type } = mapSlotTypeToScriptFields(slot.video_type);

  let winnerVideoId = slot.winner_video_id;

  if (!winnerVideoId) {
    const note = [
      "[Winner sourcing recreate]",
      `slot:${slot.id}`,
      `bunch:${slot.bunch_id}`,
      slot.source === "from_winner" ? `from_winner:${slot.winner_submission_id ?? ""}` : "researcher_submitted",
      `seq:${slot.sequence_number}`,
      slot.description,
    ]
      .filter(Boolean)
      .join(" | ");

    const wv = await createWinnerVideoRow({
      video_id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      reference_model_id: bunch?.model_id || undefined,
      reference_model_name: creatorName,
      content_type,
      video_link: slot.video_link,
      note,
      submitted_by_id: input.actor_user_id?.trim() || "system",
      submitted_by_name: input.actor_user_name?.trim() || "Winner sourcing",
      submitted_at: new Date().toISOString(),
      status: "Approved",
      assigned_creator_name: creatorName,
      assigned_creative_id: input.assigned_creative_id.trim(),
      assigned_creative_name: input.assigned_creative_name.trim(),
      script_status: "Needs Script",
      script_video_type,
      reviewed_by_name: input.actor_user_name?.trim() || "Winner sourcing",
      reviewed_at: new Date().toISOString(),
      bunch_id: slot.bunch_id,
      bunch_name: bunch?.name || "",
    });
    winnerVideoId = wv.id;

    if (!input.skip_notify) {
      await notify({
        user_id: input.assigned_creative_id.trim(),
        event_type: NOTIFICATION_EVENT.RESEARCH_ASSIGNED_TO_CREATIVE,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "🎬 New recreate needs a script",
        body: `A Winner sourcing recreate for ${creatorName} was assigned to you.`,
        entity_type: NOTIFICATION_ENTITY.CREATIVE_SCRIPT,
        entity_id: wv.id,
        actor_user_id: input.actor_user_id,
        _triggerSource: "winner_sourcing_assign_creative",
      }).catch(() => {});
    }
  } else {
    await updateWinnerVideoFields(winnerVideoId, {
      assigned_creative_id: input.assigned_creative_id.trim(),
      assigned_creative_name: input.assigned_creative_name.trim(),
      assigned_creator_name: creatorName,
      script_status: "Needs Script",
      script_video_type,
      bunch_id: slot.bunch_id,
      bunch_name: bunch?.name || "",
    });
  }

  const { data: updated, error: upErr } = await sb
    .from("recreate_video_slots")
    .update({
      assigned_creative_id: input.assigned_creative_id.trim(),
      assigned_creative_name: input.assigned_creative_name.trim(),
      winner_video_id: winnerVideoId,
      status: "Needs Script",
      updated_at: new Date().toISOString(),
    })
    .eq("id", slot.id)
    .select("*")
    .single();
  if (upErr) throw new Error(upErr.message);

  slot = mapSlot(updated as Record<string, unknown>);
  return slot;
}

/**
 * Assign (or re-assign) a creative to an entire video bunch.
 * Updates the bunch, then applies to current slots that have not yet submitted a script
 * (Not Applicable / Needs Script). Slots at Pending Review or later keep historical attribution.
 * Future slots inherit via createSlotFromApprovedWinnerVideo / assignQueueItemToBunch.
 */
export async function assignCreativeToBunch(input: {
  bunch_id: string;
  assigned_creative_id: string;
  assigned_creative_name: string;
  actor_user_id?: string;
  actor_user_name?: string;
}): Promise<{ bunch: VideoBunch; updated_slots: RecreateVideoSlot[]; skipped_slots: number }> {
  const creativeId = input.assigned_creative_id.trim();
  const creativeName = input.assigned_creative_name.trim();
  if (!creativeId) throw new Error("Creative is required");
  if (!creativeName) throw new Error("Creative name is required");

  const sb = getSupabaseServiceClient();
  const { data: bunchRow, error: bunchErr } = await sb
    .from("video_bunches")
    .update({
      assigned_creative_id: creativeId,
      assigned_creative_name: creativeName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.bunch_id)
    .select("*")
    .single();
  if (bunchErr) throw new Error(`assignCreativeToBunch: ${bunchErr.message}`);
  if (!bunchRow) throw new Error("Bunch not found");

  const bunch = mapBunch(bunchRow as Record<string, unknown>);
  const slots = await listSlotsForBunch(bunch.id);
  const updatedSlots: RecreateVideoSlot[] = [];
  let skipped = 0;
  const slotErrors: string[] = [];

  for (const slot of slots) {
    if (!slotInheritsBunchCreative(slot.status)) {
      skipped += 1;
      continue;
    }
    try {
      if (!slotFilled(slot)) {
        // Stamp denormalized creative; scripts spawn once the slot is filled.
        const { data: stamped, error: stampErr } = await sb
          .from("recreate_video_slots")
          .update({
            assigned_creative_id: creativeId,
            assigned_creative_name: creativeName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", slot.id)
          .select("*")
          .single();
        if (stampErr) throw new Error(stampErr.message);
        updatedSlots.push(mapSlot(stamped as Record<string, unknown>));
        continue;
      }
      // Filled slots: stamp slot + spawn/update winner_videos Scripts-to-Write row.
      updatedSlots.push(
        await assignCreativeToSlot({
          slot_id: slot.id,
          assigned_creative_id: creativeId,
          assigned_creative_name: creativeName,
          actor_user_id: input.actor_user_id,
          actor_user_name: input.actor_user_name,
          skip_notify: true,
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      slotErrors.push(`${slot.id}: ${msg}`);
      console.error("[winner-sourcing] assignCreativeToBunch slot failed", slot.id, err);
    }
  }

  // Backstop: Approved Research rows on this bunch that still lack the creative
  // (e.g. approve-before-assign, or slot spawn failed earlier).
  try {
    const { data: orphanWvs } = await sb
      .from("winner_videos")
      .select("id, script_status, assigned_creative_id")
      .eq("bunch_id", bunch.id)
      .eq("status", "Approved");
    for (const raw of orphanWvs ?? []) {
      const wvId = String((raw as { id: string }).id);
      const existingCreative = String(
        (raw as { assigned_creative_id?: string | null }).assigned_creative_id ?? "",
      ).trim();
      if (existingCreative) continue;
      const scriptStatus = coerceScriptStatus(
        (raw as { script_status?: string | null }).script_status,
      );
      const patch: Record<string, unknown> = {
        assigned_creative_id: creativeId,
        assigned_creative_name: creativeName,
        bunch_id: bunch.id,
        bunch_name: bunch.name,
      };
      if (!scriptStatus || scriptStatus === "Not Applicable") {
        patch.script_status = "Needs Script";
      }
      await updateWinnerVideoFields(wvId, patch).catch((err) => {
        console.error("[winner-sourcing] assignCreativeToBunch wv backstop failed", wvId, err);
      });
    }
  } catch (err) {
    console.error("[winner-sourcing] assignCreativeToBunch wv backstop query failed", err);
  }

  if (updatedSlots.length > 0) {
    await notify({
      user_id: creativeId,
      event_type: NOTIFICATION_EVENT.RESEARCH_ASSIGNED_TO_CREATIVE,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "🎬 Bunch assigned for scripting",
      body: `“${bunch.name}” was assigned to you (${updatedSlots.length} slot${updatedSlots.length === 1 ? "" : "s"} ready for scripts).`,
      entity_type: NOTIFICATION_ENTITY.CREATIVE_SCRIPT,
      entity_id: updatedSlots.find((s) => s.winner_video_id)?.winner_video_id || bunch.id,
      actor_user_id: input.actor_user_id,
      _triggerSource: "winner_sourcing_assign_bunch_creative",
    }).catch(() => {});
  }

  if (slotErrors.length > 0 && updatedSlots.length === 0) {
    throw new Error(
      `Assigned bunch but failed to propagate to slots: ${slotErrors.slice(0, 3).join("; ")}`,
    );
  }

  const refreshed = await getVideoBunch(bunch.id);
  return {
    bunch: refreshed ?? bunch,
    updated_slots: updatedSlots,
    skipped_slots: skipped,
  };
}

/** Script progress for a creative across bunches they are assigned to. */
export type BunchScriptProgress = {
  bunch_id: string;
  bunch_name: string;
  model_name: string;
  total: number;
  written: number;
};

/**
 * Progress of scripts for bunches assigned to a creative (or with slots assigned to them).
 * `written` = slots past Needs Script (Pending Review / Approved / Rejected).
 */
export async function listBunchScriptProgressForCreative(
  creativeId: string,
): Promise<BunchScriptProgress[]> {
  const id = creativeId.trim();
  if (!id) return [];
  const sb = getSupabaseServiceClient();

  const { data: bunches, error: bErr } = await sb
    .from("video_bunches")
    .select("id, name, model_name")
    .eq("assigned_creative_id", id);
  if (bErr) throw new Error(bErr.message);

  const bunchOwnedIds = new Set((bunches ?? []).map((b) => String((b as { id: string }).id)));
  const metaById = new Map(
    (bunches ?? []).map((b) => [
      String((b as { id: string }).id),
      {
        name: String((b as { name?: string }).name ?? ""),
        model_name: String((b as { model_name?: string }).model_name ?? ""),
      },
    ]),
  );

  // Include bunches where slots still reference this creative (historical / transitional).
  const { data: slotHintRows, error: sErr } = await sb
    .from("recreate_video_slots")
    .select("bunch_id")
    .eq("assigned_creative_id", id);
  if (sErr) throw new Error(sErr.message);

  const extraBunchIds = [
    ...new Set(
      (slotHintRows ?? [])
        .map((r) => String((r as { bunch_id: string }).bunch_id))
        .filter((bid) => bid && !metaById.has(bid)),
    ),
  ];
  if (extraBunchIds.length > 0) {
    const { data: extra } = await sb
      .from("video_bunches")
      .select("id, name, model_name")
      .in("id", extraBunchIds);
    for (const b of extra ?? []) {
      const bid = String((b as { id: string }).id);
      metaById.set(bid, {
        name: String((b as { name?: string }).name ?? ""),
        model_name: String((b as { model_name?: string }).model_name ?? ""),
      });
    }
  }

  if (metaById.size === 0) return [];

  const ids = [...metaById.keys()];
  const { data: allSlots, error: allErr } = await sb
    .from("recreate_video_slots")
    .select("bunch_id, status, assigned_creative_id, winner_video_id")
    .in("bunch_id", ids);
  if (allErr) throw new Error(allErr.message);

  const progress = new Map<string, { total: number; written: number }>();
  for (const raw of allSlots ?? []) {
    const r = raw as {
      bunch_id: string;
      status: string;
      assigned_creative_id?: string | null;
      winner_video_id?: string | null;
    };
    const bid = String(r.bunch_id);
    const slotCreative = String(r.assigned_creative_id ?? "").trim();
    const status = coerceScriptStatus(r.status);
    const bunchOwned = bunchOwnedIds.has(bid);

    // Count slots owned by this creative (denormalized) or active script work under a bunch they own.
    const countThis =
      slotCreative === id ||
      (bunchOwned && (status === "Needs Script" || Boolean(r.winner_video_id)));
    if (!countThis) continue;

    const cur = progress.get(bid) ?? { total: 0, written: 0 };
    cur.total += 1;
    if (status === "Pending Review" || status === "Approved" || status === "Rejected") {
      cur.written += 1;
    }
    progress.set(bid, cur);
  }

  return ids
    .map((bid) => {
      const p = progress.get(bid) ?? { total: 0, written: 0 };
      const meta = metaById.get(bid);
      return {
        bunch_id: bid,
        bunch_name: meta?.name || "Bunch",
        model_name: meta?.model_name || "",
        total: p.total,
        written: p.written,
      };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => a.bunch_name.localeCompare(b.bunch_name));
}

/** Slot metadata for Creative Scripts UI (recreate index within a winner group). */
export type SlotScriptMeta = {
  winner_video_id: string;
  bunch_id: string;
  bunch_name: string;
  sequence_number: number;
  recreate_index: number;
  recreate_total: number;
  video_type: string;
  video_type_other: string;
  description: string;
  video_link: string;
};

type SlotRowForMeta = {
  id: string;
  bunch_id: string;
  sequence_number: number;
  winner_submission_id: string | null;
  winner_video_id: string | null;
  video_type: string;
  video_type_other: string;
  description: string;
  video_link: string;
  assigned_creative_id: string | null;
};

export async function listSlotScriptMetaForCreative(
  creativeId: string,
): Promise<SlotScriptMeta[]> {
  const id = creativeId.trim();
  if (!id) return [];
  const sb = getSupabaseServiceClient();

  const { data: bunches } = await sb
    .from("video_bunches")
    .select("id, name")
    .eq("assigned_creative_id", id);
  const nameById = new Map(
    (bunches ?? []).map((b) => [
      String((b as { id: string }).id),
      String((b as { name?: string }).name ?? ""),
    ]),
  );

  const selectCols =
    "id, bunch_id, sequence_number, winner_submission_id, winner_video_id, video_type, video_type_other, description, video_link, assigned_creative_id, status";

  const { data: slots, error } = await sb
    .from("recreate_video_slots")
    .select(selectCols)
    .not("winner_video_id", "is", null)
    .eq("assigned_creative_id", id);
  if (error) throw new Error(error.message);

  const bunchIds = [...nameById.keys()];
  let bunchSlots: unknown[] = [];
  if (bunchIds.length > 0) {
    const { data } = await sb
      .from("recreate_video_slots")
      .select(selectCols)
      .in("bunch_id", bunchIds)
      .not("winner_video_id", "is", null);
    bunchSlots = data ?? [];
  }

  const byId = new Map<string, SlotRowForMeta>();
  for (const raw of [...(slots ?? []), ...bunchSlots]) {
    const r = raw as Record<string, unknown>;
    const sid = String(r.id ?? "");
    if (!sid) continue;
    byId.set(sid, {
      id: sid,
      bunch_id: String(r.bunch_id ?? ""),
      sequence_number: Number(r.sequence_number) || 1,
      winner_submission_id: r.winner_submission_id ? String(r.winner_submission_id) : null,
      winner_video_id: r.winner_video_id ? String(r.winner_video_id) : null,
      video_type: String(r.video_type ?? ""),
      video_type_other: String(r.video_type_other ?? ""),
      description: String(r.description ?? ""),
      video_link: String(r.video_link ?? ""),
      assigned_creative_id: r.assigned_creative_id ? String(r.assigned_creative_id) : null,
    });
  }
  const merged = [...byId.values()];

  const groups = new Map<string, SlotRowForMeta[]>();
  for (const s of merged) {
    const key = s.winner_submission_id ? `w:${s.winner_submission_id}` : `s:${s.id}`;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.sequence_number - b.sequence_number);
  }

  const out: SlotScriptMeta[] = [];
  for (const list of groups.values()) {
    const total = list.length;
    list.forEach((s, i) => {
      const wvId = String(s.winner_video_id ?? "").trim();
      if (!wvId) return;
      out.push({
        winner_video_id: wvId,
        bunch_id: s.bunch_id,
        bunch_name: nameById.get(s.bunch_id) || "",
        sequence_number: s.sequence_number,
        recreate_index: i + 1,
        recreate_total: total,
        video_type: s.video_type || "",
        video_type_other: s.video_type_other || "",
        description: s.description || "",
        video_link: s.video_link || "",
      });
    });
  }
  return out;
}

/** Sync slot status from its linked winner_videos Creative Scripts row. */
export async function syncSlotScriptStatus(slotId: string): Promise<RecreateVideoSlot | null> {
  const sb = getSupabaseServiceClient();
  const { data: row } = await sb.from("recreate_video_slots").select("*").eq("id", slotId).maybeSingle();
  if (!row) return null;
  const slot = mapSlot(row as Record<string, unknown>);
  if (!slot.winner_video_id) return slot;

  const { data: wv } = await sb
    .from("winner_videos")
    .select("script_status")
    .or(`id.eq.${slot.winner_video_id},airtable_id.eq.${slot.winner_video_id}`)
    .maybeSingle();
  if (!wv) return slot;

  const next = coerceScriptStatus((wv as { script_status?: string }).script_status);
  if (next === slot.status) return slot;

  const { data: updated, error } = await sb
    .from("recreate_video_slots")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", slotId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapSlot(updated as Record<string, unknown>);
}

/**
 * When a Creative Scripts work item (winner_videos row) changes script_status,
 * mirror it onto any linked recreate_video_slots. No-op if none linked.
 */
export async function syncSlotsForWinnerVideoId(
  winnerVideoId: string,
  scriptStatus: ScriptStatus,
): Promise<void> {
  const id = winnerVideoId.trim();
  if (!id) return;
  const sb = getSupabaseServiceClient();
  await sb
    .from("recreate_video_slots")
    .update({ status: scriptStatus, updated_at: new Date().toISOString() })
    .eq("winner_video_id", id);
}

export async function syncAdminInstructionsForWinnerVideo(
  winnerVideoId: string,
  adminInstructions: string,
): Promise<void> {
  const sb = getSupabaseServiceClient();
  await sb
    .from("recreate_video_slots")
    .update({ admin_instructions: adminInstructions.trim(), updated_at: new Date().toISOString() })
    .eq("winner_video_id", winnerVideoId);
}
