/**
 * Recording Briefs — Creative Director → Creator (model) structured filming briefs.
 * Permission-gated. Text preserved exactly (emoji, line breaks, capitalisation).
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { greeceLocalToUtc } from "@/lib/brief-deadlines";
import {
  assertRecordingTransition,
  type BriefActorCapability,
  type RecordingBriefStatus,
  BriefTransitionError,
} from "@/lib/brief-status-transitions";
import { notify } from "@/services/notification-service";
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_EVENT,
  NOTIFICATION_PRIORITY,
} from "@/lib/notification-types";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getActiveModelUserAirtableIdByLinkedModelRecordId,
  listUsersWithPermission,
} from "@/services/users";
import type { NotificationPriority } from "@/types";

export type { RecordingBriefStatus };
export type RecordingBriefPriority = "normal" | "urgent";

export type RecordingBriefVariation = {
  id: string;
  brief_id: string;
  position: number;
  name: string;
  script_shot_list: string;
  takes: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type RecordingBrief = {
  id: string;
  title: string;
  model_id: string;
  reference_links: string[];
  priority: RecordingBriefPriority;
  deadline_at: string | null;
  concept_why: string;
  setup_camera: string;
  setup_framing: string;
  setup_location: string;
  setup_outfit: string;
  setup_light: string;
  setup_sound: string;
  setup_notes: string;
  how_to_talk: string;
  how_to_act: string;
  props: string;
  checklist_before_upload: string;
  upload_path: string;
  clip_naming: string;
  status: RecordingBriefStatus;
  created_by: string;
  reminder_sent_at: string | null;
  overdue_alerted_at: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  variations: RecordingBriefVariation[];
};

export type RecordingBriefVariationInput = {
  name?: string;
  script_shot_list?: string;
  takes?: number;
  notes?: string;
};

export type RecordingBriefInput = {
  title: string;
  model_id: string;
  reference_links?: string[];
  priority?: RecordingBriefPriority;
  /** Greece local `YYYY-MM-DDTHH:mm` or ISO UTC. */
  deadline_local_greece?: string | null;
  deadline_at?: string | null;
  concept_why?: string;
  setup_camera?: string;
  setup_framing?: string;
  setup_location?: string;
  setup_outfit?: string;
  setup_light?: string;
  setup_sound?: string;
  setup_notes?: string;
  how_to_talk?: string;
  how_to_act?: string;
  props?: string;
  checklist_before_upload?: string;
  upload_path?: string;
  clip_naming?: string;
  status?: RecordingBriefStatus;
  variations?: RecordingBriefVariationInput[];
  created_by?: string;
};

export type ListRecordingBriefsFilters = {
  model_id?: string;
  status?: RecordingBriefStatus | "all" | "active";
  priority?: RecordingBriefPriority | "all";
  model_ids?: string[];
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function asNullableString(v: unknown): string | null {
  if (v == null) return null;
  return typeof v === "string" ? v : String(v);
}

function parseLinks(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => (typeof x === "string" ? x : String(x ?? ""))).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((x) => (typeof x === "string" ? x : String(x ?? ""))).filter(Boolean);
      }
    } catch {
      return raw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function resolveDeadlineUtc(input: RecordingBriefInput): string | null {
  if (input.deadline_local_greece != null && String(input.deadline_local_greece).trim()) {
    return greeceLocalToUtc(String(input.deadline_local_greece).trim()).toISOString();
  }
  if (input.deadline_at === null) return null;
  if (input.deadline_at != null && String(input.deadline_at).trim()) {
    const d = new Date(String(input.deadline_at));
    if (Number.isNaN(d.getTime())) throw new Error("Invalid deadline_at");
    return d.toISOString();
  }
  return null;
}

function mapVariation(row: Record<string, unknown>): RecordingBriefVariation {
  return {
    id: asString(row.id),
    brief_id: asString(row.brief_id),
    position: typeof row.position === "number" ? row.position : Number(row.position) || 0,
    name: asString(row.name),
    script_shot_list: asString(row.script_shot_list),
    takes: typeof row.takes === "number" ? row.takes : Number(row.takes) || 2,
    notes: asString(row.notes),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  };
}

function mapBrief(
  row: Record<string, unknown>,
  variations: RecordingBriefVariation[],
): RecordingBrief {
  return {
    id: asString(row.id),
    title: asString(row.title),
    model_id: asString(row.model_id),
    reference_links: parseLinks(row.reference_links),
    priority: (asString(row.priority) || "normal") as RecordingBriefPriority,
    deadline_at: asNullableString(row.deadline_at),
    concept_why: asString(row.concept_why),
    setup_camera: asString(row.setup_camera),
    setup_framing: asString(row.setup_framing),
    setup_location: asString(row.setup_location),
    setup_outfit: asString(row.setup_outfit),
    setup_light: asString(row.setup_light),
    setup_sound: asString(row.setup_sound),
    setup_notes: asString(row.setup_notes),
    how_to_talk: asString(row.how_to_talk),
    how_to_act: asString(row.how_to_act),
    props: asString(row.props),
    checklist_before_upload: asString(row.checklist_before_upload),
    upload_path: asString(row.upload_path),
    clip_naming: asString(row.clip_naming),
    status: (asString(row.status) || "draft") as RecordingBriefStatus,
    created_by: asString(row.created_by),
    reminder_sent_at: asNullableString(row.reminder_sent_at),
    overdue_alerted_at: asNullableString(row.overdue_alerted_at),
    uploaded_at: asNullableString(row.uploaded_at),
    uploaded_by: asNullableString(row.uploaded_by),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    variations: [...variations].sort((a, b) => a.position - b.position),
  };
}

async function loadVariations(
  briefIds: string[],
): Promise<Map<string, RecordingBriefVariation[]>> {
  const map = new Map<string, RecordingBriefVariation[]>();
  if (!briefIds.length) return map;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("recording_brief_variations")
    .select("*")
    .in("brief_id", briefIds)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const v = mapVariation(row as Record<string, unknown>);
    const list = map.get(v.brief_id) ?? [];
    list.push(v);
    map.set(v.brief_id, list);
  }
  return map;
}

function sortBriefs(briefs: RecordingBrief[]): RecordingBrief[] {
  return [...briefs].sort((a, b) => {
    if (a.priority === "urgent" && b.priority !== "urgent") return -1;
    if (b.priority === "urgent" && a.priority !== "urgent") return 1;
    const da = a.deadline_at || "";
    const db = b.deadline_at || "";
    if (da && db && da !== db) return da.localeCompare(db);
    if (da && !db) return -1;
    if (db && !da) return 1;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });
}

async function replaceVariations(
  briefId: string,
  variations: RecordingBriefVariationInput[],
): Promise<RecordingBriefVariation[]> {
  const sb = getSupabaseServiceClient();
  const { error: delErr } = await sb
    .from("recording_brief_variations")
    .delete()
    .eq("brief_id", briefId);
  if (delErr) throw new Error(delErr.message);
  if (!variations.length) return [];
  const rows = variations.map((v, i) => ({
    brief_id: briefId,
    position: i,
    name: v.name ?? "",
    script_shot_list: v.script_shot_list ?? "",
    takes: typeof v.takes === "number" && v.takes > 0 ? Math.round(v.takes) : 2,
    notes: v.notes ?? "",
  }));
  const { data, error } = await sb.from("recording_brief_variations").insert(rows).select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapVariation(r as Record<string, unknown>));
}

async function notifyCreator(params: {
  brief: RecordingBrief;
  event: "published" | "updated" | "reminder";
  actorUserId?: string;
}): Promise<void> {
  const { brief, event, actorUserId } = params;
  const creatorId = await getActiveModelUserAirtableIdByLinkedModelRecordId(brief.model_id);
  if (!creatorId || creatorId === actorUserId) return;

  const isUrgent = brief.priority === "urgent";
  const priority: NotificationPriority =
    event === "reminder" || isUrgent
      ? NOTIFICATION_PRIORITY.HIGH
      : NOTIFICATION_PRIORITY.NORMAL;

  const eventType =
    event === "published"
      ? NOTIFICATION_EVENT.RECORDING_BRIEF_PUBLISHED
      : event === "updated"
        ? NOTIFICATION_EVENT.RECORDING_BRIEF_UPDATED
        : NOTIFICATION_EVENT.RECORDING_BRIEF_REMINDER;

  const title =
    event === "published"
      ? isUrgent
        ? `Urgent recording brief: ${brief.title}`
        : `New recording brief: ${brief.title}`
      : event === "updated"
        ? `Recording brief updated: ${brief.title}`
        : `Recording deadline soon: ${brief.title}`;

  const body =
    event === "reminder"
      ? `Deadline approaching — mark Uploaded when footage is in place`
      : event === "published"
        ? `Open to review Concept, Setup, Variations, and upload path`
        : `Open to see the latest filming instructions`;

  await notify({
    user_id: creatorId,
    event_type: eventType,
    priority,
    title,
    body,
    entity_type: NOTIFICATION_ENTITY.RECORDING_BRIEF,
    entity_id: brief.id,
    actor_user_id: actorUserId,
    _triggerSource: `recording_brief_${event}`,
  }).catch((err) => console.error(`[recording_brief_${event}] notify failed`, err));
}

async function notifyManageHolders(params: {
  brief: RecordingBrief;
  event: "uploaded" | "overdue";
  actorUserId?: string;
}): Promise<void> {
  const { brief, event, actorUserId } = params;
  const holders = await listUsersWithPermission(PERMISSIONS.RECORDING_BRIEFS_MANAGE).catch(
    () => [],
  );
  const eventType =
    event === "uploaded"
      ? NOTIFICATION_EVENT.RECORDING_BRIEF_UPLOADED
      : NOTIFICATION_EVENT.RECORDING_BRIEF_OVERDUE;
  const title =
    event === "uploaded"
      ? `Recording uploaded: ${brief.title}`
      : `Recording overdue: ${brief.title}`;
  const body =
    event === "uploaded"
      ? `Creator marked footage as Uploaded`
      : `Deadline passed without Uploaded`;

  const ids = new Set(holders.map((u) => u.id).filter(Boolean));
  if (brief.created_by) ids.add(brief.created_by);

  await Promise.all(
    [...ids]
      .filter((id) => id && id !== actorUserId)
      .map((user_id) =>
        notify({
          user_id,
          event_type: eventType,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title,
          body,
          entity_type: NOTIFICATION_ENTITY.RECORDING_BRIEF,
          entity_id: brief.id,
          actor_user_id: actorUserId,
          _triggerSource: `recording_brief_${event}`,
        }).catch((err) => console.error(`[recording_brief_${event}] notify failed`, err)),
      ),
  );
}

export async function listRecordingBriefs(
  filters: ListRecordingBriefsFilters = {},
): Promise<RecordingBrief[]> {
  const sb = getSupabaseServiceClient();
  let q = sb.from("recording_briefs").select("*");

  const status = filters.status ?? "active";
  if (status === "active") {
    q = q.in("status", ["published", "uploaded"]);
  } else if (status !== "all") {
    q = q.eq("status", status);
  }
  if (filters.model_id) q = q.eq("model_id", filters.model_id);
  if (filters.priority && filters.priority !== "all") q = q.eq("priority", filters.priority);
  if (filters.model_ids?.length) q = q.in("model_id", filters.model_ids);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const vars = await loadVariations(rows.map((r) => asString(r.id)));
  return sortBriefs(rows.map((r) => mapBrief(r, vars.get(asString(r.id)) ?? [])));
}

export async function getRecordingBriefById(id: string): Promise<RecordingBrief | null> {
  const bid = id.trim();
  if (!bid) return null;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from("recording_briefs").select("*").eq("id", bid).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const vars = await loadVariations([bid]);
  return mapBrief(data as Record<string, unknown>, vars.get(bid) ?? []);
}

function rowFromInput(input: RecordingBriefInput, createdBy?: string): Record<string, unknown> {
  const deadline = resolveDeadlineUtc(input);
  return {
    title: input.title ?? "",
    model_id: input.model_id ?? "",
    reference_links: input.reference_links ?? [],
    priority: input.priority ?? "normal",
    deadline_at: deadline,
    concept_why: input.concept_why ?? "",
    setup_camera: input.setup_camera ?? "",
    setup_framing: input.setup_framing ?? "",
    setup_location: input.setup_location ?? "",
    setup_outfit: input.setup_outfit ?? "",
    setup_light: input.setup_light ?? "",
    setup_sound: input.setup_sound ?? "",
    setup_notes: input.setup_notes ?? "",
    how_to_talk: input.how_to_talk ?? "",
    how_to_act: input.how_to_act ?? "",
    props: input.props ?? "",
    checklist_before_upload: input.checklist_before_upload ?? "",
    upload_path: input.upload_path ?? "",
    clip_naming: input.clip_naming ?? "",
    status: input.status ?? "draft",
    ...(createdBy != null ? { created_by: createdBy } : {}),
    updated_at: new Date().toISOString(),
  };
}

export async function createRecordingBrief(
  input: RecordingBriefInput,
  opts?: { notify?: boolean; actorUserId?: string },
): Promise<RecordingBrief> {
  if (!(input.title ?? "").trim()) throw new Error("Title is required");
  if (!(input.model_id ?? "").trim()) throw new Error("Model is required");

  const sb = getSupabaseServiceClient();
  const row = rowFromInput(input, input.created_by ?? "");
  const { data, error } = await sb.from("recording_briefs").insert(row).select("*").single();
  if (error) throw new Error(error.message);

  const briefId = asString((data as Record<string, unknown>).id);
  const variations = await replaceVariations(briefId, input.variations ?? []);
  const brief = mapBrief(data as Record<string, unknown>, variations);

  if (opts?.notify && brief.status === "published") {
    await notifyCreator({ brief, event: "published", actorUserId: opts.actorUserId });
  }
  return brief;
}

export async function updateRecordingBrief(
  id: string,
  input: Partial<RecordingBriefInput>,
  opts?: { notify?: boolean; actorUserId?: string },
): Promise<RecordingBrief> {
  const existing = await getRecordingBriefById(id);
  if (!existing) throw new Error("Brief not found");

  const merged: RecordingBriefInput = {
    title: input.title ?? existing.title,
    model_id: input.model_id ?? existing.model_id,
    reference_links: input.reference_links ?? existing.reference_links,
    priority: input.priority ?? existing.priority,
    deadline_local_greece: input.deadline_local_greece,
    deadline_at:
      input.deadline_local_greece !== undefined
        ? undefined
        : input.deadline_at !== undefined
          ? input.deadline_at
          : existing.deadline_at,
    concept_why: input.concept_why ?? existing.concept_why,
    setup_camera: input.setup_camera ?? existing.setup_camera,
    setup_framing: input.setup_framing ?? existing.setup_framing,
    setup_location: input.setup_location ?? existing.setup_location,
    setup_outfit: input.setup_outfit ?? existing.setup_outfit,
    setup_light: input.setup_light ?? existing.setup_light,
    setup_sound: input.setup_sound ?? existing.setup_sound,
    setup_notes: input.setup_notes ?? existing.setup_notes,
    how_to_talk: input.how_to_talk ?? existing.how_to_talk,
    how_to_act: input.how_to_act ?? existing.how_to_act,
    props: input.props ?? existing.props,
    checklist_before_upload: input.checklist_before_upload ?? existing.checklist_before_upload,
    upload_path: input.upload_path ?? existing.upload_path,
    clip_naming: input.clip_naming ?? existing.clip_naming,
    status: input.status ?? existing.status,
    variations: input.variations,
  };

  if (input.status && input.status !== existing.status) {
    assertRecordingTransition({
      from: existing.status,
      to: input.status,
      capabilities: ["manage"],
    });
  }

  const sb = getSupabaseServiceClient();
  const patch = rowFromInput(merged);
  // Preserve created_by; reset reminder flags if deadline changes while published
  delete patch.created_by;
  if (
    existing.status === "published" &&
    patch.deadline_at !== existing.deadline_at
  ) {
    patch.reminder_sent_at = null;
    patch.overdue_alerted_at = null;
  }

  const { data, error } = await sb
    .from("recording_briefs")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  let variations = existing.variations;
  if (input.variations) {
    variations = await replaceVariations(id, input.variations);
  }
  const brief = mapBrief(data as Record<string, unknown>, variations);

  const becamePublished =
    existing.status !== "published" && brief.status === "published";
  const editedWhileActive =
    existing.status === "published" && brief.status === "published";

  if (opts?.notify) {
    if (becamePublished) {
      await notifyCreator({ brief, event: "published", actorUserId: opts.actorUserId });
    } else if (editedWhileActive) {
      await notifyCreator({ brief, event: "updated", actorUserId: opts.actorUserId });
    }
  }
  return brief;
}

export async function transitionRecordingBriefStatus(params: {
  id: string;
  to: RecordingBriefStatus;
  capabilities: BriefActorCapability[];
  ownsModel?: boolean;
  actorUserId?: string;
}): Promise<RecordingBrief> {
  const existing = await getRecordingBriefById(params.id);
  if (!existing) throw new Error("Brief not found");

  try {
    assertRecordingTransition({
      from: existing.status,
      to: params.to,
      capabilities: params.capabilities,
      ownsModel: params.ownsModel,
    });
  } catch (e) {
    if (e instanceof BriefTransitionError) throw e;
    throw e;
  }

  const sb = getSupabaseServiceClient();
  const patch: Record<string, unknown> = {
    status: params.to,
    updated_at: new Date().toISOString(),
  };
  if (params.to === "uploaded") {
    patch.uploaded_at = new Date().toISOString();
    patch.uploaded_by = params.actorUserId ?? "";
  }
  if (params.to === "published" && existing.status === "draft") {
    patch.reminder_sent_at = null;
    patch.overdue_alerted_at = null;
  }

  const { data, error } = await sb
    .from("recording_briefs")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const brief = mapBrief(data as Record<string, unknown>, existing.variations);

  if (params.to === "published" && existing.status !== "published") {
    await notifyCreator({ brief, event: "published", actorUserId: params.actorUserId });
  }
  if (params.to === "uploaded") {
    await notifyManageHolders({ brief, event: "uploaded", actorUserId: params.actorUserId });
  }
  return brief;
}

export async function duplicateRecordingBrief(
  id: string,
  actorUserId?: string,
): Promise<RecordingBrief> {
  const src = await getRecordingBriefById(id);
  if (!src) throw new Error("Brief not found");
  return createRecordingBrief(
    {
      title: `${src.title} (copy)`,
      model_id: src.model_id,
      reference_links: src.reference_links,
      priority: src.priority,
      deadline_at: src.deadline_at,
      concept_why: src.concept_why,
      setup_camera: src.setup_camera,
      setup_framing: src.setup_framing,
      setup_location: src.setup_location,
      setup_outfit: src.setup_outfit,
      setup_light: src.setup_light,
      setup_sound: src.setup_sound,
      setup_notes: src.setup_notes,
      how_to_talk: src.how_to_talk,
      how_to_act: src.how_to_act,
      props: src.props,
      checklist_before_upload: src.checklist_before_upload,
      upload_path: src.upload_path,
      clip_naming: src.clip_naming,
      status: "draft",
      variations: src.variations.map((v) => ({
        name: v.name,
        script_shot_list: v.script_shot_list,
        takes: v.takes,
        notes: v.notes,
      })),
      created_by: actorUserId ?? src.created_by,
    },
    { notify: false },
  );
}

/** Build clip file list from variations × takes using clip naming pattern. */
export function buildClipFileListFromRecording(brief: RecordingBrief): string[] {
  const pattern = (brief.clip_naming || "V{n}_take{t}").trim() || "V{n}_take{t}";
  const lines: string[] = [];
  brief.variations.forEach((v, vi) => {
    const n = vi + 1;
    const takes = Math.max(1, v.takes || 2);
    for (let t = 1; t <= takes; t++) {
      lines.push(
        pattern
          .replace(/\{n\}/gi, String(n))
          .replace(/\{t\}/gi, String(t))
          .replace(/V(\d+)/i, (_m, _d) => `V${n}`)
          .replace(/take(\d+)/i, (_m, _d) => `take${t}`),
      );
    }
  });
  // If pattern had no placeholders, still expand simply
  if (!lines.length && brief.variations.length) {
    brief.variations.forEach((v, vi) => {
      const takes = Math.max(1, v.takes || 2);
      for (let t = 1; t <= takes; t++) {
        lines.push(`V${vi + 1}_take${t}`);
      }
    });
  }
  return lines;
}

export async function runRecordingBriefDeadlineJobs(leadHours: number): Promise<{
  reminders: number;
  overdue: number;
}> {
  const sb = getSupabaseServiceClient();
  const now = new Date();
  const reminderUntil = new Date(now.getTime() + leadHours * 3600_000);

  let reminders = 0;
  let overdue = 0;

  const { data: dueReminders, error: remErr } = await sb
    .from("recording_briefs")
    .select("*")
    .eq("status", "published")
    .is("reminder_sent_at", null)
    .not("deadline_at", "is", null)
    .lte("deadline_at", reminderUntil.toISOString())
    .gt("deadline_at", now.toISOString());
  if (remErr) throw new Error(remErr.message);

  for (const row of dueReminders ?? []) {
    const id = asString((row as Record<string, unknown>).id);
    const vars = await loadVariations([id]);
    const brief = mapBrief(row as Record<string, unknown>, vars.get(id) ?? []);
    const { error } = await sb
      .from("recording_briefs")
      .update({ reminder_sent_at: now.toISOString() })
      .eq("id", id)
      .is("reminder_sent_at", null);
    if (error) continue;
    await notifyCreator({ brief, event: "reminder" });
    reminders += 1;
  }

  const { data: overdueRows, error: odErr } = await sb
    .from("recording_briefs")
    .select("*")
    .eq("status", "published")
    .is("overdue_alerted_at", null)
    .not("deadline_at", "is", null)
    .lt("deadline_at", now.toISOString());
  if (odErr) throw new Error(odErr.message);

  for (const row of overdueRows ?? []) {
    const id = asString((row as Record<string, unknown>).id);
    const vars = await loadVariations([id]);
    const brief = mapBrief(row as Record<string, unknown>, vars.get(id) ?? []);
    const { error } = await sb
      .from("recording_briefs")
      .update({ overdue_alerted_at: now.toISOString() })
      .eq("id", id)
      .is("overdue_alerted_at", null);
    if (error) continue;
    await notifyManageHolders({ brief, event: "overdue" });
    overdue += 1;
  }

  return { reminders, overdue };
}
