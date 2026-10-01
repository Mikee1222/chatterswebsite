/**
 * model_user_profiles — many-to-many between model login users and modelss profiles.
 * Supabase source of truth; users.linked_model stays a denormalized mirror.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  mapLinkedIds,
  requireSbUuidsOrEmpty,
  sbResolveUuidToAirtableMap,
} from "@/lib/supabase-data";
import { isSupabaseBackend } from "@/lib/data-backend";

type JoinRow = {
  user_id: string;
  model_id: string;
  is_primary: boolean;
};

async function resolveUserUuid(publicOrUuid: string): Promise<string | null> {
  const id = publicOrUuid.trim();
  if (!id) return null;
  const uuids = await requireSbUuidsOrEmpty("users", [id], "model_user_profiles.user_id");
  return uuids[0] ?? null;
}

async function resolveModelUuids(publicOrUuids: string[]): Promise<string[]> {
  return requireSbUuidsOrEmpty("modelss", publicOrUuids, "model_user_profiles.model_id");
}

/** Public model ids linked to a user, primary first. */
export async function listLinkedModelIdsForUser(userPublicId: string): Promise<{
  modelIds: string[];
  primaryModelId: string | null;
}> {
  if (!isSupabaseBackend()) {
    return { modelIds: [], primaryModelId: null };
  }
  const userUuid = await resolveUserUuid(userPublicId);
  if (!userUuid) return { modelIds: [], primaryModelId: null };

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("model_user_profiles")
    .select("user_id,model_id,is_primary")
    .eq("user_id", userUuid)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`list model_user_profiles: ${error.message}`);
  const rows = (data ?? []) as JoinRow[];
  if (!rows.length) return { modelIds: [], primaryModelId: null };

  const modelAt = await sbResolveUuidToAirtableMap(
    "modelss",
    rows.map((r) => [r.model_id])
  );
  const modelIds = mapLinkedIds(
    rows.map((r) => r.model_id),
    modelAt
  );
  const primaryRow = rows.find((r) => r.is_primary) ?? rows[0];
  const primaryModelId = primaryRow
    ? modelAt.get(primaryRow.model_id) || primaryRow.model_id
    : null;
  return { modelIds, primaryModelId };
}

/** Active model login user for a profile (notifications). */
export async function getLinkedUserIdForModel(modelPublicId: string): Promise<string | null> {
  if (!isSupabaseBackend()) return null;
  const modelUuids = await resolveModelUuids([modelPublicId]);
  const modelUuid = modelUuids[0];
  if (!modelUuid) return null;

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("model_user_profiles")
    .select("user_id,model_id,is_primary")
    .eq("model_id", modelUuid)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`get model_user_profiles by model: ${error.message}`);
  if (!data) return null;
  const userAt = await sbResolveUuidToAirtableMap("users", [[(data as JoinRow).user_id]]);
  return userAt.get((data as JoinRow).user_id) || (data as JoinRow).user_id;
}

/**
 * Replace all profile links for a model user.
 * Enforces one user per profile: steals model links from other users if needed.
 * Syncs users.linked_model denormalized array.
 */
export async function setLinkedModelsForUser(
  userPublicId: string,
  modelPublicIds: string[],
  primaryModelPublicId?: string | null
): Promise<void> {
  if (!isSupabaseBackend()) return;

  const userUuid = await resolveUserUuid(userPublicId);
  if (!userUuid) throw new Error("User not found for model profile links.");

  const uniqueModelPublicIds = [
    ...new Set(modelPublicIds.map((id) => id.trim()).filter(Boolean)),
  ];
  const modelUuids = await resolveModelUuids(uniqueModelPublicIds);
  if (modelUuids.length !== uniqueModelPublicIds.length) {
    throw new Error("One or more model profiles could not be resolved.");
  }

  let primaryUuid: string | null = null;
  if (primaryModelPublicId?.trim()) {
    const p = await resolveModelUuids([primaryModelPublicId.trim()]);
    primaryUuid = p[0] ?? null;
    if (primaryUuid && !modelUuids.includes(primaryUuid)) {
      primaryUuid = modelUuids[0] ?? null;
    }
  } else {
    primaryUuid = modelUuids[0] ?? null;
  }

  const sb = getSupabaseServiceClient();

  // Steal exclusive model ownership from other users.
  if (modelUuids.length) {
    const { error: stealErr } = await sb
      .from("model_user_profiles")
      .delete()
      .in("model_id", modelUuids)
      .neq("user_id", userUuid);
    if (stealErr) throw new Error(`clear conflicting model links: ${stealErr.message}`);
  }

  const { error: delErr } = await sb.from("model_user_profiles").delete().eq("user_id", userUuid);
  if (delErr) throw new Error(`clear user model links: ${delErr.message}`);

  if (modelUuids.length) {
    const rows = modelUuids.map((model_id) => ({
      user_id: userUuid,
      model_id,
      is_primary: primaryUuid != null && model_id === primaryUuid,
    }));
    // Ensure exactly one primary when we have links.
    if (!rows.some((r) => r.is_primary) && rows[0]) rows[0].is_primary = true;

    const { error: insErr } = await sb.from("model_user_profiles").insert(rows);
    if (insErr) throw new Error(`insert model_user_profiles: ${insErr.message}`);
  }

  // Mirror onto users.linked_model (primary first).
  const ordered = primaryUuid
    ? [primaryUuid, ...modelUuids.filter((id) => id !== primaryUuid)]
    : modelUuids;
  const { error: syncErr } = await sb
    .from("users")
    .update({ linked_model: ordered, updated_at: new Date().toISOString() })
    .eq("id", userUuid);
  if (syncErr) throw new Error(`sync users.linked_model: ${syncErr.message}`);

  // Re-sync stolen users' linked_model mirrors.
  if (modelUuids.length) {
    const { data: affected } = await sb
      .from("users")
      .select("id,linked_model")
      .contains("linked_model", modelUuids);
    for (const row of affected ?? []) {
      const uid = String((row as { id: string }).id);
      if (uid === userUuid) continue;
      const remaining = ((row as { linked_model?: string[] | null }).linked_model ?? []).filter(
        (id) => !modelUuids.includes(id)
      );
      await sb
        .from("users")
        .update({ linked_model: remaining, updated_at: new Date().toISOString() })
        .eq("id", uid);
    }
  }
}

/**
 * Ensure a model profile is linked to selectedUserId (or unlink all users from it).
 * Preserves the selected user's other profile links.
 */
export async function relinkSingleModelProfile(
  modelPublicId: string,
  selectedUserPublicId: string | null
): Promise<void> {
  if (!isSupabaseBackend()) return;
  const modelUuids = await resolveModelUuids([modelPublicId]);
  const modelUuid = modelUuids[0];
  if (!modelUuid) return;

  const sb = getSupabaseServiceClient();

  // Who currently owns this model?
  const { data: existing } = await sb
    .from("model_user_profiles")
    .select("user_id")
    .eq("model_id", modelUuid)
    .maybeSingle();
  const previousUserUuid = existing ? String((existing as { user_id: string }).user_id) : null;

  if (!selectedUserPublicId?.trim()) {
    if (previousUserUuid) {
      await sb.from("model_user_profiles").delete().eq("model_id", modelUuid);
      const { data: rest } = await sb
        .from("model_user_profiles")
        .select("model_id,is_primary")
        .eq("user_id", previousUserUuid)
        .order("is_primary", { ascending: false });
      const remaining = ((rest ?? []) as Array<{ model_id: string }>).map((r) => r.model_id);
      await sb
        .from("users")
        .update({ linked_model: remaining, updated_at: new Date().toISOString() })
        .eq("id", previousUserUuid);
    }
    return;
  }

  const userUuid = await resolveUserUuid(selectedUserPublicId);
  if (!userUuid) throw new Error("Selected model user account not found.");

  // Remove from previous owner if different.
  if (previousUserUuid && previousUserUuid !== userUuid) {
    await sb.from("model_user_profiles").delete().eq("model_id", modelUuid).eq("user_id", previousUserUuid);
    const { data: rest } = await sb
      .from("model_user_profiles")
      .select("model_id")
      .eq("user_id", previousUserUuid);
    const remaining = ((rest ?? []) as Array<{ model_id: string }>).map((r) => r.model_id);
    await sb
      .from("users")
      .update({ linked_model: remaining, updated_at: new Date().toISOString() })
      .eq("id", previousUserUuid);
  }

  // Upsert onto selected user.
  const { data: currentLinks } = await sb
    .from("model_user_profiles")
    .select("model_id,is_primary")
    .eq("user_id", userUuid);
  const current = (currentLinks ?? []) as Array<{ model_id: string; is_primary: boolean }>;
  const already = current.some((r) => r.model_id === modelUuid);
  if (!already) {
    const isPrimary = current.length === 0;
    const { error } = await sb.from("model_user_profiles").insert({
      user_id: userUuid,
      model_id: modelUuid,
      is_primary: isPrimary,
    });
    if (error) throw new Error(`link model profile: ${error.message}`);
  }

  const { data: finalLinks } = await sb
    .from("model_user_profiles")
    .select("model_id,is_primary")
    .eq("user_id", userUuid)
    .order("is_primary", { ascending: false });
  const ordered = ((finalLinks ?? []) as Array<{ model_id: string; is_primary: boolean }>).map(
    (r) => r.model_id
  );
  await sb
    .from("users")
    .update({ linked_model: ordered, updated_at: new Date().toISOString() })
    .eq("id", userUuid);
}

/** Batch: public model ids per user public id (from join table). */
export async function mapLinkedModelIdsByUserIds(
  userPublicIds: string[]
): Promise<Map<string, { modelIds: string[]; primaryModelId: string | null }>> {
  const out = new Map<string, { modelIds: string[]; primaryModelId: string | null }>();
  if (!isSupabaseBackend() || !userPublicIds.length) return out;

  const sb = getSupabaseServiceClient();
  const userUuids = await requireSbUuidsOrEmpty("users", userPublicIds, "users");
  if (!userUuids.length) return out;

  const { data, error } = await sb
    .from("model_user_profiles")
    .select("user_id,model_id,is_primary")
    .in("user_id", userUuids)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`batch model_user_profiles: ${error.message}`);
  const rows = (data ?? []) as JoinRow[];
  if (!rows.length) return out;

  const [userAt, modelAt] = await Promise.all([
    sbResolveUuidToAirtableMap(
      "users",
      rows.map((r) => [r.user_id])
    ),
    sbResolveUuidToAirtableMap(
      "modelss",
      rows.map((r) => [r.model_id])
    ),
  ]);

  const byUserUuid = new Map<string, JoinRow[]>();
  for (const r of rows) {
    const list = byUserUuid.get(r.user_id) ?? [];
    list.push(r);
    byUserUuid.set(r.user_id, list);
  }

  for (const [userUuid, list] of byUserUuid) {
    const publicUserId = userAt.get(userUuid) || userUuid;
    const modelIds = mapLinkedIds(
      list.map((r) => r.model_id),
      modelAt
    );
    const primaryRow = list.find((r) => r.is_primary) ?? list[0];
    const primaryModelId = primaryRow
      ? modelAt.get(primaryRow.model_id) || primaryRow.model_id
      : null;
    out.set(publicUserId, { modelIds, primaryModelId });
    // Also key by uuid for callers that use internal ids.
    out.set(userUuid, { modelIds, primaryModelId });
  }
  return out;
}
