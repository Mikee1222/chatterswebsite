/**
 * iCloud organization — multi-folder entries + material runway + bunch complete.
 * Permission-gated (icloud_management:view / manage); no per-bunch assignment.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  bunchReadyForIcloud,
  coerceIcloudStatus,
  daysUntilMaterialDate,
  MATERIAL_RUNWAY_SORT,
  materialRunwayTier,
  type IcloudStatus,
  type MaterialRunwayTier,
} from "@/lib/icloud-helpers";
import { getVideoBunch, listVideoBunches, type VideoBunch } from "@/services/winner-sourcing";
import { listFilmingSchedule, type FilmingScheduleEntry } from "@/services/filming";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { PERMISSIONS } from "@/lib/permissions";
import { listUsersWithPermission } from "@/services/users";
import type { NotificationEventType, NotificationPriority } from "@/types";

async function notifyPermissionHolders(params: {
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
  event_type: NotificationEventType;
  priority: NotificationPriority;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string;
  actor_user_id?: string;
  excludeUserId?: string;
  triggerSource: string;
}): Promise<void> {
  const users = await listUsersWithPermission(params.permission).catch(() => []);
  await Promise.all(
    users
      .filter((u) => u.id && u.id !== params.excludeUserId)
      .map((u) =>
        notify({
          user_id: u.id,
          event_type: params.event_type,
          priority: params.priority,
          title: params.title,
          body: params.body,
          entity_type: params.entity_type,
          entity_id: params.entity_id,
          actor_user_id: params.actor_user_id,
          _triggerSource: params.triggerSource,
        }).catch(() => {}),
      ),
  );
}

export type IcloudFolderEntry = {
  id: string;
  bunch_id: string;
  model_id: string;
  folder_label: string;
  folder_link: string;
  material_until_date: string | null;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
};

export type IcloudBunchWork = {
  bunch: VideoBunch;
  folders: IcloudFolderEntry[];
  furthest_material_until: string | null;
};

function mapFolder(row: Record<string, unknown>): IcloudFolderEntry {
  return {
    id: String(row.id),
    bunch_id: String(row.bunch_id),
    model_id: String(row.model_id ?? ""),
    folder_label: String(row.folder_label ?? ""),
    folder_link: String(row.folder_link ?? ""),
    material_until_date: row.material_until_date
      ? String(row.material_until_date).slice(0, 10)
      : null,
    created_by_id: String(row.created_by_id ?? ""),
    created_by_name: String(row.created_by_name ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

export async function listFoldersForBunch(bunchId: string): Promise<IcloudFolderEntry[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("icloud_folder_entries")
    .select("*")
    .eq("bunch_id", bunchId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listFoldersForBunch: ${error.message}`);
  return (data ?? []).map((r) => mapFolder(r as Record<string, unknown>));
}

export async function listFoldersForBunches(
  bunchIds: string[],
): Promise<Record<string, IcloudFolderEntry[]>> {
  const ids = [...new Set(bunchIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return {};
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("icloud_folder_entries")
    .select("*")
    .in("bunch_id", ids)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listFoldersForBunches: ${error.message}`);
  const out: Record<string, IcloudFolderEntry[]> = {};
  for (const id of ids) out[id] = [];
  for (const row of data ?? []) {
    const entry = mapFolder(row as Record<string, unknown>);
    if (!out[entry.bunch_id]) out[entry.bunch_id] = [];
    out[entry.bunch_id]!.push(entry);
  }
  return out;
}

/** Bunches ready for iCloud (editing uploaded) — all holders of icloud_management:view see them. */
export async function listIcloudOrganizationWork(): Promise<IcloudBunchWork[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("video_bunches")
    .select("*")
    .eq("editing_status", "uploaded")
    .in("icloud_status", ["pending", "in_progress", "organized"])
    .order("edited_uploaded_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`listIcloudOrganizationWork: ${error.message}`);

  const results: IcloudBunchWork[] = [];
  for (const row of data ?? []) {
    const bunch = await getVideoBunch(String(row.id));
    if (!bunch) continue;
    if (!bunchReadyForIcloud(bunch)) continue;
    const folders = await listFoldersForBunch(bunch.id);
    const furthest = furthestMaterialUntil(folders);
    results.push({ bunch, folders, furthest_material_until: furthest });
  }
  return results;
}

function furthestMaterialUntil(folders: IcloudFolderEntry[]): string | null {
  let best: string | null = null;
  for (const f of folders) {
    const d = f.material_until_date;
    if (!d) continue;
    if (!best || d > best) best = d;
  }
  return best;
}

export async function addIcloudFolderEntry(input: {
  bunch_id: string;
  folder_label: string;
  folder_link?: string;
  material_until_date?: string | null;
  created_by_id: string;
  created_by_name: string;
}): Promise<IcloudFolderEntry> {
  const label = input.folder_label.trim();
  if (!label) throw new Error("Folder label is required");

  const bunch = await getVideoBunch(input.bunch_id);
  if (!bunch) throw new Error("Bunch not found");
  if (!bunchReadyForIcloud(bunch)) {
    throw new Error("Editing must be uploaded before organizing iCloud folders");
  }
  if (bunch.icloud_status === "organized") {
    throw new Error("Bunch iCloud organization is already complete");
  }

  const materialUntil = (input.material_until_date ?? "").trim().slice(0, 10) || null;
  if (materialUntil && !/^\d{4}-\d{2}-\d{2}$/.test(materialUntil)) {
    throw new Error("material_until_date must be YYYY-MM-DD");
  }

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("icloud_folder_entries")
    .insert({
      bunch_id: bunch.id,
      model_id: bunch.model_id,
      folder_label: label,
      folder_link: (input.folder_link ?? "").trim(),
      material_until_date: materialUntil,
      created_by_id: input.created_by_id.trim(),
      created_by_name: input.created_by_name.trim(),
    })
    .select("*")
    .single();
  if (error) throw new Error(`addIcloudFolderEntry: ${error.message}`);

  const status = coerceIcloudStatus(bunch.icloud_status);
  if (status === "pending") {
    await sb
      .from("video_bunches")
      .update({ icloud_status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", bunch.id);
  }

  return mapFolder(data as Record<string, unknown>);
}

export async function updateIcloudFolderEntry(
  id: string,
  patch: Partial<{
    folder_label: string;
    folder_link: string;
    material_until_date: string | null;
  }>,
): Promise<IcloudFolderEntry> {
  const sb = getSupabaseServiceClient();
  const updates: Record<string, unknown> = {};
  if (patch.folder_label !== undefined) {
    const label = patch.folder_label.trim();
    if (!label) throw new Error("Folder label is required");
    updates.folder_label = label;
  }
  if (patch.folder_link !== undefined) updates.folder_link = patch.folder_link.trim();
  if (patch.material_until_date !== undefined) {
    const raw = (patch.material_until_date ?? "").trim().slice(0, 10);
    if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      throw new Error("material_until_date must be YYYY-MM-DD");
    }
    updates.material_until_date = raw || null;
  }
  if (Object.keys(updates).length === 0) throw new Error("No updates");

  const { data, error } = await sb
    .from("icloud_folder_entries")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`updateIcloudFolderEntry: ${error.message}`);
  return mapFolder(data as Record<string, unknown>);
}

export async function deleteIcloudFolderEntry(id: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb.from("icloud_folder_entries").delete().eq("id", id);
  if (error) throw new Error(`deleteIcloudFolderEntry: ${error.message}`);
}

export async function markBunchIcloudOrganized(input: {
  bunch_id: string;
  actor_user_id: string;
  actor_user_name?: string;
}): Promise<VideoBunch> {
  const bunch = await getVideoBunch(input.bunch_id);
  if (!bunch) throw new Error("Bunch not found");
  if (!bunchReadyForIcloud(bunch)) {
    throw new Error("Editing must be uploaded before completing iCloud organization");
  }

  const folders = await listFoldersForBunch(bunch.id);
  if (folders.length === 0) {
    throw new Error("Add at least one iCloud folder entry before marking complete");
  }

  const now = new Date().toISOString();
  const sb = getSupabaseServiceClient();
  const { error } = await sb
    .from("video_bunches")
    .update({
      icloud_status: "organized",
      icloud_organized_at: now,
      updated_at: now,
    })
    .eq("id", bunch.id);
  if (error) throw new Error(`markBunchIcloudOrganized: ${error.message}`);

  await notifyPermissionHolders({
    permission: PERMISSIONS.ICLOUD_MANAGEMENT_MANAGE,
    event_type: NOTIFICATION_EVENT.BUNCH_ICLOUD_ORGANIZED,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: "☁️ iCloud organization complete",
    body: `${input.actor_user_name || "Staff"} organized iCloud for “${bunch.name}” (${bunch.model_name}) — ${folders.length} folder${folders.length === 1 ? "" : "s"}.`,
    entity_type: NOTIFICATION_ENTITY.ICLOUD_ORGANIZATION,
    entity_id: bunch.id,
    actor_user_id: input.actor_user_id,
    excludeUserId: input.actor_user_id,
    triggerSource: "mark_bunch_icloud_organized",
  });

  const refreshed = await getVideoBunch(bunch.id);
  return refreshed ?? { ...bunch, icloud_status: "organized" as IcloudStatus, icloud_organized_at: now };
}

export type ModelMaterialRunway = {
  model_id: string;
  model_name: string;
  furthest_material_until: string | null;
  days_remaining: number | null;
  alert: MaterialRunwayTier;
  next_shoot: FilmingScheduleEntry | null;
  last_shoot: FilmingScheduleEntry | null;
};

export type IcloudFolderWithBunch = IcloudFolderEntry & {
  bunch_name: string;
};

export type IcloudModelCoverage = {
  model_id: string;
  model_name: string;
  folders: IcloudFolderWithBunch[];
  furthest_material_until: string | null;
  days_remaining: number | null;
  runway: MaterialRunwayTier;
  needs_organization_count: number;
};

export type IcloudManagementOverview = {
  work: IcloudBunchWork[];
  models: IcloudModelCoverage[];
  needsOrganization: IcloudBunchWork[];
};

/** Per-model material runway + filming schedule context for Admin Pipeline Overview. */
export async function getPipelineOverviewContext(): Promise<{
  bunches: VideoBunch[];
  foldersByBunch: Record<string, IcloudFolderEntry[]>;
  modelRunways: ModelMaterialRunway[];
}> {
  const bunches = await listVideoBunches();
  const foldersByBunch = await listFoldersForBunches(bunches.map((b) => b.id));

  const byModel = new Map<string, { model_name: string; furthest: string | null }>();
  for (const b of bunches) {
    if (!b.model_id) continue;
    const folders = foldersByBunch[b.id] ?? [];
    const furthest = furthestMaterialUntil(folders);
    const existing = byModel.get(b.model_id);
    if (!existing) {
      byModel.set(b.model_id, { model_name: b.model_name, furthest });
    } else {
      if (furthest && (!existing.furthest || furthest > existing.furthest)) {
        existing.furthest = furthest;
      }
      if (!existing.model_name && b.model_name) existing.model_name = b.model_name;
    }
  }

  // Also include models that only have folders (edge) — already covered via bunches.
  const today = new Date().toISOString().slice(0, 10);
  const schedule = await listFilmingSchedule().catch(() => [] as FilmingScheduleEntry[]);

  const modelRunways: ModelMaterialRunway[] = [];
  for (const [model_id, info] of byModel) {
    const modelShoots = schedule
      .filter((s) => s.model_id === model_id)
      .sort((a, b) => a.schedule_date.localeCompare(b.schedule_date));
    const next_shoot = modelShoots.find((s) => s.schedule_date >= today) ?? null;
    const past = modelShoots.filter((s) => s.schedule_date < today);
    const last_shoot = past.length ? past[past.length - 1]! : null;
    const days = daysUntilMaterialDate(info.furthest);
    modelRunways.push({
      model_id,
      model_name: info.model_name || model_id,
      furthest_material_until: info.furthest,
      days_remaining: days,
      alert: materialRunwayTier(days),
      next_shoot,
      last_shoot,
    });
  }
  modelRunways.sort((a, b) => {
    const ao = MATERIAL_RUNWAY_SORT[a.alert];
    const bo = MATERIAL_RUNWAY_SORT[b.alert];
    if (ao !== bo) return ao - bo;
    const da = a.days_remaining ?? 9999;
    const db = b.days_remaining ?? 9999;
    if (da !== db) return da - db;
    return a.model_name.localeCompare(b.model_name);
  });

  return { bunches, foldersByBunch, modelRunways };
}

/** Admin / manager overview: model-first coverage + needs-organization queue + by-bunch work. */
export async function getIcloudManagementOverview(): Promise<IcloudManagementOverview> {
  const work = await listIcloudOrganizationWork();
  const needsOrganization = work.filter((w) => w.bunch.icloud_status !== "organized");

  const sb = getSupabaseServiceClient();
  const { data: folderRows, error } = await sb.from("icloud_folder_entries").select("*");
  if (error) throw new Error(`getIcloudManagementOverview: ${error.message}`);
  const folders = (folderRows ?? []).map((r) => mapFolder(r as Record<string, unknown>));

  const bunchNameById = new Map<string, string>();
  const modelNameById = new Map<string, string>();
  for (const w of work) {
    bunchNameById.set(w.bunch.id, w.bunch.name);
    if (w.bunch.model_id) {
      modelNameById.set(w.bunch.model_id, w.bunch.model_name || w.bunch.model_id);
    }
  }

  const missingBunchIds = [
    ...new Set(folders.map((f) => f.bunch_id).filter((id) => id && !bunchNameById.has(id))),
  ];
  if (missingBunchIds.length > 0) {
    const { data: bunches } = await sb
      .from("video_bunches")
      .select("id, name, model_id, model_name")
      .in("id", missingBunchIds);
    for (const row of bunches ?? []) {
      const id = String((row as { id: string }).id);
      const name = String((row as { name?: string }).name ?? "");
      const modelId = String((row as { model_id?: string }).model_id ?? "");
      const modelName = String((row as { model_name?: string }).model_name ?? "");
      bunchNameById.set(id, name || id);
      if (modelId) modelNameById.set(modelId, modelName || modelId);
    }
  }

  const byModel = new Map<string, IcloudFolderWithBunch[]>();
  for (const f of folders) {
    const mid = f.model_id || "unknown";
    if (!byModel.has(mid)) byModel.set(mid, []);
    byModel.get(mid)!.push({
      ...f,
      bunch_name: bunchNameById.get(f.bunch_id) ?? "—",
    });
  }

  for (const w of work) {
    const mid = w.bunch.model_id;
    if (!mid) continue;
    if (!byModel.has(mid)) byModel.set(mid, []);
    modelNameById.set(mid, w.bunch.model_name || mid);
  }

  const needsCountByModel = new Map<string, number>();
  for (const w of needsOrganization) {
    const mid = w.bunch.model_id;
    if (!mid) continue;
    needsCountByModel.set(mid, (needsCountByModel.get(mid) ?? 0) + 1);
  }

  const models: IcloudModelCoverage[] = [];
  for (const [model_id, modelFolders] of byModel) {
    modelFolders.sort((a, b) => {
      if (!a.material_until_date && !b.material_until_date) return 0;
      if (!a.material_until_date) return 1;
      if (!b.material_until_date) return -1;
      return a.material_until_date.localeCompare(b.material_until_date);
    });
    const furthest = furthestMaterialUntil(modelFolders);
    const days = daysUntilMaterialDate(furthest);
    models.push({
      model_id,
      model_name: modelNameById.get(model_id) || model_id,
      folders: modelFolders,
      furthest_material_until: furthest,
      days_remaining: days,
      runway: materialRunwayTier(days),
      needs_organization_count: needsCountByModel.get(model_id) ?? 0,
    });
  }

  models.sort((a, b) => {
    const ao = MATERIAL_RUNWAY_SORT[a.runway];
    const bo = MATERIAL_RUNWAY_SORT[b.runway];
    if (ao !== bo) return ao - bo;
    const da = a.days_remaining ?? 9999;
    const db = b.days_remaining ?? 9999;
    if (da !== db) return da - db;
    return a.model_name.localeCompare(b.model_name);
  });

  return { work, models, needsOrganization };
}

/**
 * Cron: notify icloud_management:manage when any folder's material_until is within 7 days or past.
 * Dedup via entity_id `material_until:{folderId}:{date}`.
 */
export async function runMaterialUntilApproachingAlerts(): Promise<{
  ok: true;
  folders_scanned: number;
  notifications_sent: number;
}> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("icloud_folder_entries")
    .select("*")
    .not("material_until_date", "is", null);
  if (error) throw new Error(error.message);

  const managers = await listUsersWithPermission(PERMISSIONS.ICLOUD_MANAGEMENT_MANAGE).catch(() => []);
  let notifications_sent = 0;
  const folders = (data ?? []).map((r) => mapFolder(r as Record<string, unknown>));

  for (const folder of folders) {
    const days = daysUntilMaterialDate(folder.material_until_date);
    if (days == null) continue;
    if (days > 7) continue;

    const alertEntityId = `material_until:${folder.id}:${folder.material_until_date}`;
    const bunch = await getVideoBunch(folder.bunch_id).catch(() => null);
    const modelLabel = bunch?.model_name || folder.model_id || "model";
    const title =
      days < 0
        ? "⚠️ Material runway expired"
        : "⏰ Material runway approaching";
    const body =
      days < 0
        ? `“${folder.folder_label}” for ${modelLabel} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago (${folder.material_until_date}).`
        : days === 0
          ? `“${folder.folder_label}” for ${modelLabel} runs out today (${folder.material_until_date}).`
          : `“${folder.folder_label}” for ${modelLabel} runs out in ${days} day${days === 1 ? "" : "s"} (${folder.material_until_date}).`;

    for (const u of managers) {
      if (!u.id) continue;
      // Dedup: check recent notification with same entity_id
      const { data: existing } = await sb
        .from("notifications")
        .select("id")
        .eq("user_id", u.id)
        .eq("entity_id", alertEntityId)
        .eq("event_type", NOTIFICATION_EVENT.MATERIAL_UNTIL_APPROACHING)
        .limit(1)
        .maybeSingle();
      if (existing) continue;

      await notify({
        user_id: u.id,
        event_type: NOTIFICATION_EVENT.MATERIAL_UNTIL_APPROACHING,
        priority: days < 0 ? NOTIFICATION_PRIORITY.HIGH : NOTIFICATION_PRIORITY.NORMAL,
        title,
        body,
        entity_type: NOTIFICATION_ENTITY.ICLOUD_ORGANIZATION,
        entity_id: alertEntityId,
        _triggerSource: "material_until_approaching_cron",
      }).catch(() => {});
      notifications_sent++;
    }
  }

  return { ok: true, folders_scanned: folders.length, notifications_sent };
}
