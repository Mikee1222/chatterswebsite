import {
  createRecord,
  updateRecord,
  getRecord,
  listAllRecords,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { resolveStageOwner, type PipelineRole } from "@/services/creator-assignments";
// NOTE: services/modelss + services/users are "use server" modules — importing them
// statically here breaks client-reference splitting when this module is reached through
// a server action imported by a client component. Load them dynamically inside the fn.

const TABLE = "content_items";
const EVENTS_TABLE = "content_item_events";

export type ContentStage =
  | "creative"
  | "filming"
  | "icloud_raw"
  | "editing"
  | "icloud_edited"
  | "post"
  | "analytics"
  | "done";

export type ContentStatus =
  | "in_progress"
  | "awaiting_qa"
  | "rejected"
  | "blocked_unassigned"
  | "done";

/** Which role owns each stage (for auto-routing on stage entry). */
export const STAGE_ROLE: Record<Exclude<ContentStage, "analytics" | "done">, PipelineRole> = {
  creative: "creative",
  filming: "filmer",
  icloud_raw: "icloud-manager",
  editing: "editor",
  icloud_edited: "icloud-manager",
  post: "marketing-executive",
};

type Fields = {
  item_id?: string;
  title?: string;
  creator_model_id?: string;
  creator_name?: string;
  week?: string;
  source?: string;
  research_idea_id?: string;
  winner_video_id?: string;
  stage?: string;
  status?: string;
  assignee_user_id?: string;
  assignee_name?: string;
  film_type?: string;
  reference_link?: string;
  stage_entered_at?: string;
  assigned_at?: string;
  deadline?: string;
  priority?: string;
  created_at?: string;
  updated_at?: string;
};

export type ContentItem = {
  id: string;
  title: string;
  creator_model_id: string;
  creator_name: string;
  week: string;
  source: string;
  stage: string;
  status: string;
  assignee_user_id: string;
  assignee_name: string;
  film_type: string;
  reference_link: string;
  stage_entered_at: string;
  assigned_at: string;
  deadline: string;
};

function mapItem(rec: AirtableRecord<Fields>): ContentItem {
  const f = rec.fields;
  return {
    id: rec.id,
    title: f.title ?? "",
    creator_model_id: f.creator_model_id ?? "",
    creator_name: f.creator_name ?? "",
    week: f.week ?? "",
    source: f.source ?? "",
    stage: f.stage ?? "",
    status: f.status ?? "",
    assignee_user_id: f.assignee_user_id ?? "",
    assignee_name: f.assignee_name ?? "",
    film_type: f.film_type ?? "",
    reference_link: f.reference_link ?? "",
    stage_entered_at: f.stage_entered_at ?? "",
    assigned_at: f.assigned_at ?? "",
    deadline: f.deadline ?? "",
  };
}

export async function logContentEvent(input: {
  item_id: string;
  stage: string;
  action: "spawned" | "entered" | "completed" | "qa_approved" | "qa_rejected" | "reassigned" | "blocked";
  actor_user_id: string;
  actor_name: string;
  note?: string;
  duration_seconds?: number;
}): Promise<void> {
  try {
    await createRecord(EVENTS_TABLE, {
      event_id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      item_id: input.item_id,
      stage: input.stage,
      action: input.action,
      actor_user_id: input.actor_user_id,
      actor_name: input.actor_name,
      at: new Date().toISOString(),
      ...(input.note ? { note: input.note } : {}),
      ...(typeof input.duration_seconds === "number" ? { duration_seconds: input.duration_seconds } : {}),
    });
  } catch {
    // Event logging is best-effort; never block the pipeline on audit write.
  }
}

const STAGE_NAME: Record<string, string> = {
  creative: "Creative", filming: "Filming", icloud_raw: "iCloud/RAW", editing: "Editing", icloud_edited: "iCloud (edited)", post: "Post",
};

/** Best-effort push to the person who now owns an item. Never throws. */
async function notifyOwner(userId: string, itemId: string, title: string, stage: string, actorId: string): Promise<void> {
  if (!userId) return;
  try {
    const [{ notify }, { NOTIFICATION_EVENT }] = await Promise.all([
      import("@/services/notification-service"),
      import("@/lib/notification-types"),
    ]);
    await notify({
      user_id: userId,
      event_type: NOTIFICATION_EVENT.VA_TASK_ASSIGNED,
      title: `🎬 Νέα δουλειά — ${STAGE_NAME[stage] ?? stage}`,
      body: title,
      entity_type: "content_item",
      entity_id: itemId,
      actor_user_id: actorId || undefined,
      priority: "normal",
    });
  } catch {
    /* best-effort */
  }
}

/** Best-effort push to everyone who can QA (Manos etc.) that something is waiting. Never throws. */
async function notifyQaHolders(itemId: string, title: string, stage: string, actorId: string): Promise<void> {
  try {
    const [{ notify }, { NOTIFICATION_EVENT }, { listUsersWithPermission }, { PERMISSIONS }] = await Promise.all([
      import("@/services/notification-service"),
      import("@/lib/notification-types"),
      import("@/services/users"),
      import("@/lib/permissions"),
    ]);
    const holders = await listUsersWithPermission(PERMISSIONS.CONTENT_PIPELINE_QA);
    for (const h of holders) {
      await notify({
        user_id: h.id,
        event_type: NOTIFICATION_EVENT.VA_TASK_ASSIGNED,
        title: `✅ Περιμένει QA — ${STAGE_NAME[stage] ?? stage}`,
        body: title,
        entity_type: "content_item",
        entity_id: itemId,
        actor_user_id: actorId || undefined,
        priority: "normal",
      });
    }
  } catch {
    /* best-effort */
  }
}

/**
 * Create a content item entering a stage. Resolves the stage owner via creator assignments;
 * if nobody is assigned, the item is created as `blocked_unassigned` (holds until assigned).
 */
export async function spawnContentItem(input: {
  title: string;
  creator_model_id: string;
  creator_name: string;
  week: string;
  source: "research" | "winner_recreate";
  research_idea_id?: string;
  winner_video_id?: string;
  reference_link?: string;
  film_type?: "self_record" | "filmer";
  stage?: ContentStage;
  actor_user_id: string;
  actor_name: string;
}): Promise<ContentItem> {
  const stage = input.stage ?? "creative";
  const role = STAGE_ROLE[stage as Exclude<ContentStage, "analytics" | "done">];
  const owner = role ? await resolveStageOwner(input.creator_model_id, role) : null;
  const now = new Date().toISOString();

  const rec = await createRecord<Fields>(TABLE, {
    item_id: `ci_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: input.title,
    creator_model_id: input.creator_model_id,
    creator_name: input.creator_name,
    week: input.week,
    source: input.source,
    ...(input.research_idea_id ? { research_idea_id: input.research_idea_id } : {}),
    ...(input.winner_video_id ? { winner_video_id: input.winner_video_id } : {}),
    ...(input.reference_link ? { reference_link: input.reference_link } : {}),
    ...(input.film_type ? { film_type: input.film_type } : {}),
    stage,
    status: owner ? "in_progress" : "blocked_unassigned",
    assignee_user_id: owner?.user_id ?? "",
    assignee_name: owner?.user_name ?? "",
    stage_entered_at: now,
    assigned_at: now,
    priority: "normal",
    created_at: now,
    updated_at: now,
  });

  await logContentEvent({
    item_id: rec.id,
    stage,
    action: "spawned",
    actor_user_id: input.actor_user_id,
    actor_name: input.actor_name,
    note: `source=${input.source}`,
  });
  if (!owner) {
    await logContentEvent({
      item_id: rec.id,
      stage,
      action: "blocked",
      actor_user_id: input.actor_user_id,
      actor_name: input.actor_name,
      note: `no ${role} assigned for creator`,
    });
  }
  if (owner) await notifyOwner(owner.user_id, rec.id, input.title, stage, input.actor_user_id);
  return mapItem(rec);
}

// ============================================================================
// Stage machine (Phase 4)
// ============================================================================

type StageConfig = {
  /** Creator-assigned role that owns this stage (null = terminal). */
  role: PipelineRole | null;
  /** QA gate before advancing (null = auto-advance on owner ✓). */
  qaRole: "head-of-marketing" | "supervisor" | null;
  next: ContentStage | null;
};

export const STAGE_FLOW: Record<ContentStage, StageConfig> = {
  creative: { role: "creative", qaRole: "head-of-marketing", next: "filming" },
  filming: { role: "filmer", qaRole: "head-of-marketing", next: "icloud_raw" },
  icloud_raw: { role: "icloud-manager", qaRole: null, next: "editing" },
  editing: { role: "editor", qaRole: "head-of-marketing", next: "icloud_edited" },
  icloud_edited: { role: "icloud-manager", qaRole: null, next: "post" },
  // Post has NO pipeline QA gate — Evi's supervision is via her forms, not an approve step.
  post: { role: "marketing-executive", qaRole: null, next: "done" },
  analytics: { role: null, qaRole: null, next: "done" },
  done: { role: null, qaRole: null, next: null },
};

function nowIso(): string {
  return new Date().toISOString();
}
function secondsSince(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 1000)) : 0;
}

export async function getItemById(id: string): Promise<ContentItem | null> {
  try {
    return mapItem(await getRecord<Fields>(TABLE, id));
  } catch {
    return null;
  }
}

/** Filming owner: self-record → the creator's model-user; filmer → assigned filmer. */
async function resolveFilmingOwner(
  creatorModelId: string,
  filmType: string
): Promise<{ user_id: string; user_name: string } | null> {
  if (filmType === "self_record") {
    const [{ listActiveGunzoTeamModelss }, { listActiveUsers }] = await Promise.all([
      import("@/services/modelss"),
      import("@/services/users"),
    ]);
    const models = await listActiveGunzoTeamModelss();
    const m = models.find((x) => x.model_id === creatorModelId);
    if (!m) return null;
    const users = await listActiveUsers();
    const mu = users.find((u) => (u.role ?? "") === "model" && u.linked_model_id === m.id);
    return mu ? { user_id: mu.id, user_name: mu.full_name } : null;
  }
  return resolveStageOwner(creatorModelId, "filmer");
}

async function ownerForStage(
  item: ContentItem,
  stage: ContentStage
): Promise<{ user_id: string; user_name: string } | null> {
  if (stage === "filming") return resolveFilmingOwner(item.creator_model_id, item.film_type || "filmer");
  const role = STAGE_ROLE[stage as Exclude<ContentStage, "analytics" | "done">];
  return role ? resolveStageOwner(item.creator_model_id, role) : null;
}

/** List items currently owned by a user (their working queue). */
export async function listItemsForAssignee(userRecId: string): Promise<ContentItem[]> {
  const records = await listAllRecords<Fields>(TABLE, {
    filterByFormula: `AND({assignee_user_id} = "${userRecId.replace(/"/g, '""')}", OR({status}="in_progress",{status}="rejected"))`,
  });
  return records.map(mapItem);
}

/** Items awaiting QA (all stages). Caller filters by which stage's qaRole they hold. */
export async function listItemsAwaitingQa(): Promise<ContentItem[]> {
  const records = await listAllRecords<Fields>(TABLE, {
    filterByFormula: `{status} = "awaiting_qa"`,
  });
  return records.map(mapItem);
}

/** All non-done items (QA cockpit / overview). */
export async function listActiveContentItems(): Promise<ContentItem[]> {
  const records = await listAllRecords<Fields>(TABLE, { filterByFormula: `NOT({status} = "done")` });
  return records.map(mapItem);
}

/** Blocked (no owner) — surfaced to managers to fix assignments. */
export async function listBlockedItems(): Promise<ContentItem[]> {
  const records = await listAllRecords<Fields>(TABLE, {
    filterByFormula: `{status} = "blocked_unassigned"`,
  });
  return records.map(mapItem);
}

/** Move an item from its current stage into the next (auto-route owner + timing). */
async function advanceStage(item: ContentItem, actor: { user_id: string; user_name: string }): Promise<void> {
  const flow = STAGE_FLOW[item.stage as ContentStage];
  const next = flow?.next;
  const duration = secondsSince(item.stage_entered_at);

  await logContentEvent({
    item_id: item.id,
    stage: item.stage,
    action: "completed",
    actor_user_id: actor.user_id,
    actor_name: actor.user_name,
    duration_seconds: duration,
  });

  if (!next) {
    await updateRecord<Fields>(TABLE, item.id, { stage: "done", status: "done", updated_at: nowIso() });
    return;
  }

  // Terminal stages (analytics/done) have no owner role → mark done, not blocked.
  const isTerminal = !STAGE_ROLE[next as Exclude<ContentStage, "analytics" | "done">];
  const owner = isTerminal ? null : await ownerForStage(item, next);
  await updateRecord<Fields>(TABLE, item.id, {
    stage: next,
    status: isTerminal ? "done" : owner ? "in_progress" : "blocked_unassigned",
    assignee_user_id: owner?.user_id ?? "",
    assignee_name: owner?.user_name ?? "",
    stage_entered_at: nowIso(),
    assigned_at: nowIso(),
    updated_at: nowIso(),
  });
  await logContentEvent({
    item_id: item.id,
    stage: next,
    action: owner ? "entered" : "blocked",
    actor_user_id: owner?.user_id ?? actor.user_id,
    actor_name: owner?.user_name ?? actor.user_name,
    ...(owner ? {} : { note: `no owner for ${next}` }),
  });
  if (owner) await notifyOwner(owner.user_id, item.id, item.title, next, actor.user_id);
}

/** Owner presses ✓: stages with a QA gate → awaiting_qa; otherwise auto-advance. */
export async function submitStage(itemId: string, actor: { user_id: string; user_name: string }): Promise<void> {
  const item = await getItemById(itemId);
  if (!item) throw new Error("Item not found.");
  const flow = STAGE_FLOW[item.stage as ContentStage];
  if (!flow || !flow.next) throw new Error("Δεν προχωράει άλλο.");
  if (flow.qaRole) {
    await updateRecord<Fields>(TABLE, item.id, { status: "awaiting_qa", updated_at: nowIso() });
    await logContentEvent({
      item_id: item.id,
      stage: item.stage,
      action: "completed",
      actor_user_id: actor.user_id,
      actor_name: actor.user_name,
      note: "submitted for QA",
      duration_seconds: secondsSince(item.stage_entered_at),
    });
    await notifyQaHolders(item.id, item.title, item.stage, actor.user_id);
  } else {
    await advanceStage(item, actor);
  }
}

export async function qaApproveItem(itemId: string, actor: { user_id: string; user_name: string }): Promise<void> {
  const item = await getItemById(itemId);
  if (!item) throw new Error("Item not found.");
  if (item.status !== "awaiting_qa") throw new Error("Δεν είναι σε QA.");
  await logContentEvent({
    item_id: item.id,
    stage: item.stage,
    action: "qa_approved",
    actor_user_id: actor.user_id,
    actor_name: actor.user_name,
  });
  await advanceStage(item, actor);
}

export async function qaRejectItem(
  itemId: string,
  actor: { user_id: string; user_name: string },
  note?: string
): Promise<void> {
  const item = await getItemById(itemId);
  if (!item) throw new Error("Item not found.");
  if (item.status !== "awaiting_qa") throw new Error("Δεν είναι σε QA.");
  await updateRecord<Fields>(TABLE, item.id, { status: "rejected", stage_entered_at: nowIso(), updated_at: nowIso() });
  await logContentEvent({
    item_id: item.id,
    stage: item.stage,
    action: "qa_rejected",
    actor_user_id: actor.user_id,
    actor_name: actor.user_name,
    ...(note ? { note } : {}),
  });
}

/** Manager sets self-record vs filmer for a filming item → reassigns owner accordingly. */
export async function setFilmType(
  itemId: string,
  filmType: "self_record" | "filmer",
  actor: { user_id: string; user_name: string }
): Promise<void> {
  const item = await getItemById(itemId);
  if (!item) throw new Error("Item not found.");
  const patch: Fields = { film_type: filmType, updated_at: nowIso() };
  if (item.stage === "filming") {
    const owner = await resolveFilmingOwner(item.creator_model_id, filmType);
    patch.assignee_user_id = owner?.user_id ?? "";
    patch.assignee_name = owner?.user_name ?? "";
    patch.status = owner ? (item.status === "awaiting_qa" ? "awaiting_qa" : "in_progress") : "blocked_unassigned";
  }
  await updateRecord<Fields>(TABLE, item.id, patch);
  await logContentEvent({
    item_id: item.id,
    stage: item.stage,
    action: "reassigned",
    actor_user_id: actor.user_id,
    actor_name: actor.user_name,
    note: `film_type=${filmType}`,
  });
}

/** Stage QA role → which pipeline role QAs it (for filtering a QA user's queue). */
export function qaRoleForStage(stage: string): "head-of-marketing" | "supervisor" | null {
  return STAGE_FLOW[stage as ContentStage]?.qaRole ?? null;
}
