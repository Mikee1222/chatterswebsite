/**
 * Winner Video sourcing service (Supabase-only).
 * Distinct from Research `winner_videos` — feeds Creative Scripts by spawning
 * Approved + Needs Script rows on `winner_videos` when slots are assigned.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { coerceScriptStatus, type ScriptStatus } from "@/lib/creative-scripts-helpers";
import {
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
  slotFilled,
  tierFromViewCount,
  type BunchStatus,
  type SlotSource,
  type SlotVideoType,
  type WinnerSourcingRecreateConfig,
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
  created_at: string;
  updated_at: string;
  /** Computed: recreate_video_slots currently in this bunch (approved/filled). */
  provided_count?: number;
  /** Computed: Pending Research finds awaiting approve/reject for this bunch. */
  pending_review_count?: number;
  /** Computed: target − provided − pending. */
  remaining_count?: number;
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
  video_link: string;
  video_type: SlotVideoType | "";
  status: ScriptStatus;
  assigned_creative_id: string;
  assigned_creative_name: string;
  winner_submission_id: string | null;
  winner_video_id: string | null;
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
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapSubmission(row: Record<string, unknown>): WinnerSubmission {
  const tier = coerceWinnerTier(row.tier) ?? "winner";
  return {
    id: String(row.id),
    model_id: String(row.model_id ?? ""),
    model_name: String(row.model_name ?? ""),
    submitted_by_id: String(row.submitted_by_id ?? ""),
    submitted_by_name: String(row.submitted_by_name ?? ""),
    video_link: String(row.video_link ?? ""),
    view_count: Number(row.view_count) || 0,
    tier,
    status: coerceWinnerSubmissionStatus(row.status),
    created_at: String(row.created_at ?? ""),
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
    video_link: String(row.video_link ?? ""),
    video_type: coerceSlotVideoType(row.video_type),
    status: coerceScriptStatus(row.status),
    assigned_creative_id: String(row.assigned_creative_id ?? ""),
    assigned_creative_name: String(row.assigned_creative_name ?? ""),
    winner_submission_id: row.winner_submission_id ? String(row.winner_submission_id) : null,
    winner_video_id: row.winner_video_id ? String(row.winner_video_id) : null,
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
}): Promise<WinnerSubmission> {
  const viewCount = Math.round(Number(input.view_count));
  const tier = tierFromViewCount(viewCount);
  if (!tier) {
    throw new Error(`View count must be at least 100,000 (got ${viewCount})`);
  }
  const link = input.video_link.trim();
  if (!link) throw new Error("Video link is required");
  const modelId = input.model_id.trim();
  if (!modelId) throw new Error("Model is required");

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
    })
    .select("*")
    .single();

  if (error) throw new Error(`createWinnerSubmission: ${error.message}`);
  const submission = mapSubmission(data as Record<string, unknown>);

  const holders = await listUsersWithPermission(PERMISSIONS.WINNER_SOURCING_MANAGE).catch(() => []);
  for (const u of holders) {
    if (!u.id || u.id === input.submitted_by_id) continue;
    await notify({
      user_id: u.id,
      event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: `${tier === "super_winner" ? "🔥 Super Winner" : "🏆 Winner"} submitted`,
      body: `${submission.submitted_by_name} submitted a ${tier === "super_winner" ? "Super Winner" : "Winner"} for ${submission.model_name} (${viewCount.toLocaleString()} views).`,
      entity_type: NOTIFICATION_ENTITY.WINNER_VIDEO,
      entity_id: submission.id,
      actor_user_id: input.submitted_by_id,
      _triggerSource: "winner_sourcing_submit",
    }).catch(() => {});
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

  const rows = Array.from({ length: item.required_recreate_count }, (_, i) => ({
    bunch_id: bunchId,
    source: "from_winner" as const,
    sequence_number: startSeq + i,
    description: `Recreate from ${submission.tier === "super_winner" ? "Super Winner" : "Winner"}: ${submission.video_link}`,
    video_link: submission.video_link,
    video_type: "",
    status: "Not Applicable",
    winner_submission_id: submission.id,
  }));

  const { data: slotRows, error: slotErr } = await sb
    .from("recreate_video_slots")
    .insert(rows)
    .select("*");
  if (slotErr) throw new Error(`spawn slots: ${slotErr.message}`);

  return {
    item: { ...item, bunch_id: bunchId, submission, bunch_name: bunch.name },
    slots: (slotRows ?? []).map((r) => mapSlot(r as Record<string, unknown>)),
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
    sb.from("recreate_video_slots").select("bunch_id").in("bunch_id", ids),
    sb
      .from("winner_videos")
      .select("bunch_id")
      .in("bunch_id", ids)
      .eq("status", "Pending"),
  ]);
  const slotCounts = new Map<string, number>();
  for (const s of slots ?? []) {
    const bid = String((s as { bunch_id: string }).bunch_id);
    slotCounts.set(bid, (slotCounts.get(bid) ?? 0) + 1);
  }
  const pendingCounts = new Map<string, number>();
  for (const p of pendingRows ?? []) {
    const bid = String((p as { bunch_id: string }).bunch_id);
    if (!bid) continue;
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
  const { count, error } = await sb
    .from("winner_videos")
    .select("id", { count: "exact", head: true })
    .eq("bunch_id", bunchId)
    .eq("status", "Pending");
  if (error) throw new Error(error.message);
  return count ?? 0;
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
  submitted_by_id: string;
  submitted_by_name: string;
}): Promise<WinnerVideoRecord> {
  const bunch = await getVideoBunch(input.bunch_id);
  if (!bunch) throw new Error("Bunch not found");
  if (bunch.status !== "open") throw new Error("Bunch is closed");
  const remaining = bunch.remaining_count ?? 0;
  if (remaining < 1) throw new Error("Bunch has no remaining capacity");

  const description = input.description.trim();
  const video_link = input.video_link.trim();
  if (!description) throw new Error("Description is required");
  if (!video_link) throw new Error("Video link is required");
  if (!input.video_type) throw new Error("Video type is required");

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
  });
}

/**
 * On Research Manage Approve of a Fill Bunches find: create recreate_video_slot in that bunch
 * and link it to the winner_videos row (Creative Scripts work item).
 */
export async function createSlotFromApprovedWinnerVideo(input: {
  winner_video: WinnerVideoRecord;
  assigned_creative_id: string;
  assigned_creative_name: string;
}): Promise<RecreateVideoSlot> {
  const wv = input.winner_video;
  const bunchId = wv.bunch_id?.trim();
  if (!bunchId) throw new Error("Winner video has no bunch_id");

  const sb = getSupabaseServiceClient();
  const { data: existingSlot } = await sb
    .from("recreate_video_slots")
    .select("*")
    .eq("winner_video_id", wv.id)
    .maybeSingle();
  if (existingSlot) {
    return mapSlot(existingSlot as Record<string, unknown>);
  }

  const bunch = await getVideoBunch(bunchId);
  if (!bunch) throw new Error("Bunch not found");

  const video_type = mapScriptFieldsToSlotType(wv.content_type, wv.script_video_type);
  const existing = await listSlotsForBunch(bunchId);
  const nextSeq = existing.reduce((m, s) => Math.max(m, s.sequence_number), 0) + 1;
  const hasCreative = Boolean(input.assigned_creative_id.trim());

  const { data, error } = await sb
    .from("recreate_video_slots")
    .insert({
      bunch_id: bunchId,
      source: "researcher_submitted",
      sequence_number: nextSeq,
      description: wv.note || "",
      video_link: wv.video_link || "",
      video_type,
      status: hasCreative ? "Needs Script" : "Not Applicable",
      assigned_creative_id: input.assigned_creative_id.trim() || null,
      assigned_creative_name: input.assigned_creative_name.trim(),
      winner_video_id: wv.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createSlotFromApprovedWinnerVideo: ${error.message}`);
  return mapSlot(data as Record<string, unknown>);
}

export async function updateSlotContent(
  slotId: string,
  patch: {
    description?: string;
    video_link?: string;
    video_type?: SlotVideoType | "";
  },
): Promise<RecreateVideoSlot> {
  const sb = getSupabaseServiceClient();
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.description !== undefined) fields.description = patch.description.trim();
  if (patch.video_link !== undefined) fields.video_link = patch.video_link.trim();
  if (patch.video_type !== undefined) fields.video_type = patch.video_type;

  const { data, error } = await sb
    .from("recreate_video_slots")
    .update(fields)
    .eq("id", slotId)
    .select("*")
    .single();
  if (error) throw new Error(`updateSlotContent: ${error.message}`);
  return mapSlot(data as Record<string, unknown>);
}

/**
 * Assign a creative to a filled slot and spawn a Creative Scripts work item
 * on `winner_videos` (Approved + Needs Script) — same queue creatives already use.
 */
export async function assignCreativeToSlot(input: {
  slot_id: string;
  assigned_creative_id: string;
  assigned_creative_name: string;
  assigned_creator_name?: string;
  actor_user_id?: string;
  actor_user_name?: string;
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
    });
    winnerVideoId = wv.id;

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
  } else {
    await updateWinnerVideoFields(winnerVideoId, {
      assigned_creative_id: input.assigned_creative_id.trim(),
      assigned_creative_name: input.assigned_creative_name.trim(),
      assigned_creator_name: creatorName,
      script_status: "Needs Script",
      script_video_type,
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
