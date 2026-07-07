"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/routes";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { createRecord, deleteRecord, listAllRecords } from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import { createWhale, updateWhale, getWhaleById, type WhaleWriteFields } from "@/services/whales";
import { awardPoints, maybeAwardWhaleUpdatePoints } from "@/services/points-engine";
import { getPointsConfig } from "@/services/points-config";
import { notify, notifyAdmins, notifyByRoleConfig } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import {
  whaleSubmittedAwaitingAssignmentChatter,
  whaleAssignedToYou,
} from "@/lib/notification-copy";
import { devLog } from "@/lib/dev-log";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

const WHALES_TABLE = "whales";

async function requireWhalesAssign(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.WHALES_ASSIGN))) {
    return { ok: false, error: "Unauthorized" };
  }
  return { ok: true };
}

export type CreateWhaleChatterResult = { success: true } | { success: false; error: string };

const RELATIONSHIP_ALLOWED = new Set(["New", "Angry", "In Love", "Interested", "Simp"]);
const PLATFORM_ALLOWED = new Set(["onlyfans", "fanvue", "other"]);

export async function createWhaleAction(input: {
  username: string;
  platform: string;
  relationship_status: string;
  notes: string;
  hours_usually_active: string;
}): Promise<CreateWhaleChatterResult> {
  try {
    const usernameTrim = input.username?.trim() ?? "";
    devLog("[createWhale] called", { username: usernameTrim });

    const user = await getSessionFromCookies();
    if (!user || getEffectiveStaffRole(user) !== "chatter") {
      return { success: false, error: "Unauthorized" };
    }

    const chatterRecordId = user.airtableUserId ?? user.id;
    const chatterName = user.fullName?.trim() || user.email || "Chatter";

    const username = input.username.trim();
    if (!username) return { success: false, error: "Username is required" };

    const platform = (input.platform || "onlyfans").toLowerCase().trim();
    if (!PLATFORM_ALLOWED.has(platform)) {
      return { success: false, error: "Invalid platform" };
    }

    const rs = input.relationship_status.trim();
    if (!RELATIONSHIP_ALLOWED.has(rs)) {
      return { success: false, error: "Invalid relationship status" };
    }

    const noteParts = [
      input.notes.trim(),
      input.hours_usually_active.trim()
        ? `Hours usually active: ${input.hours_usually_active.trim()}`
        : "",
    ].filter(Boolean);
    const notes = noteParts.join("\n\n");

    const whale_id = `whale_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const fields: Record<string, unknown> = {
      whale_id,
      username,
      platform,
      relationship_status: rs,
      notes,
      status: "Active",
      spend_level: "low",
      total_spent: 0,
      created_by: chatterName,
    };

    const rec = await createRecord(WHALES_TABLE, fields);

    setTimeout(() => {
      void getPointsConfig()
        .then((pointsConfig) =>
          awardPoints(chatterRecordId, pointsConfig.WHALE_ADDED, "Added new whale", "whale", rec.id)
        )
        .catch((e) => console.error("[points-engine] createWhaleAction awardPoints failed", e));
    }, 100);

    const chatterSubmitted = whaleSubmittedAwaitingAssignmentChatter(username);
    try {
      await notifyByRoleConfig(NOTIFICATION_EVENT.WHALE_REGISTERED, {
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: chatterSubmitted.title,
        body: chatterSubmitted.body,
        entity_type: NOTIFICATION_ENTITY.WHALE,
        entity_id: rec.id,
        actor_user_id: chatterRecordId,
        actor_name: chatterName,
        personal_user_id: chatterRecordId,
        context: {
          whaleUsername: username,
          whaleName: username,
          chatterName,
        },
      });
    } catch (e) {
      console.error("[notify] createWhaleAction notifyByRoleConfig failed", e);
    }

    revalidatePath(ROUTES.chatter.myWhales);
    revalidatePath(ROUTES.admin.whales);

    setTimeout(() => {
      void import("@/services/challenges").then(({ updateChallengeProgress }) =>
        updateChallengeProgress(chatterRecordId, "whales_added", 1).catch((e) =>
          console.error("[challenges] updateChallengeProgress whales_added failed", e)
        )
      );
    }, 100);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[createWhale] error", message);
    return { success: false, error: message };
  }
}

/** Chatter “new whale” page: creates whale with model via server (client must not import services/whales). */
export async function createWhaleWithModelAction(input: {
  username: string;
  modelRecordId: string;
  modelName: string;
  relationship_status: string;
  notes: string;
}): Promise<AssignWhaleResult> {
  devLog("[createWhaleWithModel] called", { username: input.username?.trim() });
  try {
    const user = await getSessionFromCookies();
    if (!user || getEffectiveStaffRole(user) !== "chatter") {
      return { success: false, error: "Unauthorized" };
    }
    const chatterId = user.airtableUserId ?? user.id;
    const chatterName = user.fullName?.trim() || user.email || "Chatter";

    const u = input.username.trim();
    if (!u) return { success: false, error: "Username is required" };
    if (!input.modelRecordId.trim()) return { success: false, error: "Model is required" };

    const rs = input.relationship_status.trim();
    if (!RELATIONSHIP_ALLOWED.has(rs)) {
      return { success: false, error: "Invalid relationship status" };
    }

    const whale_id = `whale_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const modelNameTrim = input.modelName.trim();
    const whale = await createWhale({
      whale_id,
      username: u,
      assigned_model: [input.modelRecordId],
      assigned_model_name: modelNameTrim,
      relationship_status: rs,
      notes: input.notes.trim(),
      status: "Active",
      created_by: chatterName,
    });

    const chatterSubmitted = whaleSubmittedAwaitingAssignmentChatter(u);
    try {
      await notifyByRoleConfig(NOTIFICATION_EVENT.WHALE_REGISTERED, {
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: chatterSubmitted.title,
        body: chatterSubmitted.body,
        entity_type: NOTIFICATION_ENTITY.WHALE,
        entity_id: whale.id,
        actor_user_id: chatterId,
        actor_name: chatterName,
        personal_user_id: chatterId,
        context: {
          whaleUsername: u,
          whaleName: u,
          chatterName,
          modelName: modelNameTrim,
        },
      });
    } catch (e) {
      console.error("[notify] createWhaleWithModelAction notifyByRoleConfig failed", e);
    }

    setTimeout(() => {
      void getPointsConfig()
        .then((pointsConfig) =>
          awardPoints(chatterId, pointsConfig.WHALE_ADDED, "Added new whale", "whale", whale.id)
        )
        .catch((e) => console.error("[points-engine] createWhaleWithModelAction awardPoints failed", e));
    }, 100);

    revalidatePath(ROUTES.chatter.myWhales);
    revalidatePath(ROUTES.admin.whales);

    setTimeout(() => {
      void import("@/services/challenges").then(({ updateChallengeProgress }) =>
        updateChallengeProgress(chatterId, "whales_added", 1).catch((e) =>
          console.error("[challenges] updateChallengeProgress whales_added failed", e)
        )
      );
    }, 100);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[createWhaleWithModel] error", message);
    return { success: false, error: message };
  }
}

export type AssignWhaleResult = { success: true } | { success: false; error: string };

export async function assignWhaleToChatter(
  whaleRecordId: string,
  chatterRecordId: string,
  chatterName: string
): Promise<AssignWhaleResult> {
  try {
    const gate = await requireWhalesAssign();
    if (!gate.ok) return { success: false, error: gate.error };

    await updateWhale(whaleRecordId, {
      assigned_chatter: [chatterRecordId],
      assigned_chatter_name: chatterName,
    });
    const whale = await getWhaleById(whaleRecordId);
    revalidatePath(ROUTES.admin.whales);
    revalidatePath(ROUTES.chatter.myWhales);
    const uName = (whale?.username || whale?.whale_id || "fan").trim();
    const assigneeId = chatterRecordId?.trim();
    if (assigneeId) {
      try {
        const assignedCopy = whaleAssignedToYou(uName);
        await notify({
          user_id: assigneeId,
          event_type: NOTIFICATION_EVENT.WHALE_ASSIGNED,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: assignedCopy.title,
          body: assignedCopy.body,
          entity_type: NOTIFICATION_ENTITY.WHALE,
          entity_id: whaleRecordId,
          actor_name: chatterName,
        });
      } catch (e) {
        console.error("[notify] assignWhaleToChatter notify chatter failed", e);
      }
    }
    try {
      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.WHALE_ASSIGNED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "🐋 Whale assigned",
        body: `${whale?.username || whale?.whale_id || "Whale"} assigned to ${chatterName}.`,
        entity_type: NOTIFICATION_ENTITY.WHALE,
        entity_id: whaleRecordId,
        actor_user_id: assigneeId || undefined,
        actor_name: chatterName,
      });
    } catch (e) {
      console.error("[notify] assignWhaleToChatter notifyAdmins failed", e);
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function assignWhaleToModel(
  whaleRecordId: string,
  modelRecordId: string,
  modelName: string
): Promise<AssignWhaleResult> {
  try {
    const gate = await requireWhalesAssign();
    if (!gate.ok) return { success: false, error: gate.error };

    await updateWhale(whaleRecordId, {
      assigned_model: [modelRecordId],
      assigned_model_name: modelName,
    });
    const whale = await getWhaleById(whaleRecordId);
    revalidatePath(ROUTES.admin.whales);
    revalidatePath(ROUTES.chatter.myWhales);
    try {
      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.WHALE_ASSIGNED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "🐋 Whale assigned",
        body: `${whale?.username || whale?.whale_id || "Whale"} assigned to ${modelName}.`,
        entity_type: NOTIFICATION_ENTITY.WHALE,
        entity_id: whaleRecordId,
        actor_name: modelName,
      });
    } catch (e) {
      console.error("[notify] assignWhaleToModel notifyAdmins failed", e);
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/** Clear assigned model from a whale. */
export async function clearWhaleModel(whaleRecordId: string): Promise<AssignWhaleResult> {
  try {
    const gate = await requireWhalesAssign();
    if (!gate.ok) return { success: false, error: gate.error };

    await updateWhale(whaleRecordId, {
      assigned_model: [],
      assigned_model_name: "",
    });
    revalidatePath(ROUTES.admin.whales);
    revalidatePath(ROUTES.chatter.myWhales);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/** Clear assigned chatter from a whale. */
export async function clearWhaleChatter(whaleRecordId: string): Promise<AssignWhaleResult> {
  try {
    const gate = await requireWhalesAssign();
    if (!gate.ok) return { success: false, error: gate.error };

    const before = await getWhaleById(whaleRecordId);
    const previousChatterId = before?.assigned_chatter_id?.trim() ?? "";
    const whaleName = (before?.username ?? before?.whale_id ?? "Whale").trim() || "Whale";
    const whaleUsername = (before?.username ?? before?.whale_id ?? "whale").trim() || "whale";

    await updateWhale(whaleRecordId, {
      assigned_chatter: [],
      assigned_chatter_name: "",
    });
    revalidatePath(ROUTES.admin.whales);
    revalidatePath(ROUTES.chatter.myWhales);

    if (previousChatterId) {
      try {
        await notify({
          user_id: previousChatterId,
          event_type: NOTIFICATION_EVENT.WHALE_ASSIGNED,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: "🐋 Whale returned to pool",
          body: `${whaleName} (@${whaleUsername}) has been removed from your list and returned to the unassigned pool.`,
          entity_type: NOTIFICATION_ENTITY.WHALE,
          entity_id: whaleRecordId,
          _triggerSource: "clearWhaleChatter",
        });
      } catch (e) {
        console.error("[notify] clearWhaleChatter notify failed", e);
      }
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function updateWhaleFields(
  whaleRecordId: string,
  fields: WhaleWriteFields
): Promise<AssignWhaleResult> {
  try {
    const before = await getWhaleById(whaleRecordId);
    await updateWhale(whaleRecordId, fields);
    const after = await getWhaleById(whaleRecordId);
    if (before && after?.assigned_chatter_id) {
      try {
        await maybeAwardWhaleUpdatePoints(
          {
            relationship_status: before.relationship_status,
            status: before.status,
            notes: before.notes,
          },
          {
            relationship_status: after.relationship_status,
            status: after.status,
            notes: after.notes,
          },
          whaleRecordId,
          after.assigned_chatter_id
        );
      } catch (e) {
        console.error("[points-engine] maybeAwardWhaleUpdatePoints failed", e);
      }
    }
    revalidatePath(ROUTES.admin.whales);
    revalidatePath(ROUTES.chatter.myWhales);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function deleteWhale(whaleRecordId: string): Promise<AssignWhaleResult> {
  try {
    const user = await getSessionFromCookies();
    if (!user || !(await hasPermission(user, PERMISSIONS.WHALES_MANAGE))) {
      return { success: false, error: "Unauthorized" };
    }

    const txns = await listAllRecords<{ whale?: string | string[] }>("whale_transactions", {
      fields: ["whale"],
      pageSize: 100,
    });

    const relatedTxnIds = txns
      .filter((rec) => firstLinkedId(rec.fields.whale) === whaleRecordId)
      .map((rec) => rec.id);

    for (const txnId of relatedTxnIds) {
      await deleteRecord("whale_transactions", txnId);
    }

    await deleteRecord("whales", whaleRecordId);
    revalidatePath(ROUTES.admin.whales);
    revalidatePath(ROUTES.chatter.myWhales);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
