"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/routes";
import { getSessionFromCookies } from "@/lib/auth";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { notifyAdmins } from "@/services/notification-service";
import {
  deleteWhaleTransactionForChatter,
  peekWhaleTransactionForChatter,
  updateWhaleTransactionForChatter,
  type UpdateWhaleTransactionFields,
} from "@/services/whale-transactions";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateWhaleTransactionAction(
  recordId: string,
  fields: UpdateWhaleTransactionFields
): Promise<ActionResult> {
  try {
    const user = await getSessionFromCookies();
    if (!user || user.role !== "chatter") {
      return { ok: false, error: "Unauthorized" };
    }
    const chatterId = user.airtableUserId ?? user.id;
    const before = await peekWhaleTransactionForChatter(recordId, chatterId);
    if (!before) {
      return { ok: false, error: "Unauthorized" };
    }
    await updateWhaleTransactionForChatter(recordId, chatterId, fields);
    const chatterName = (before.chatter_name || user.fullName || "Chatter").trim();
    const whaleName = (before.whale_username || "Whale").trim();
    const prev = Number(before.amount);
    const amountLabel = Number.isFinite(prev) ? prev.toFixed(2) : String(before.amount);
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.WHALE_SPENT,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "💰 Whale transaction modified",
      body: `${chatterName} edited a transaction for ${whaleName}. Previous: $${amountLabel}`,
      entity_type: NOTIFICATION_ENTITY.WHALE,
      entity_id: recordId,
      actor_user_id: chatterId,
      actor_name: chatterName,
    }).catch(() => {});
    revalidatePath(ROUTES.chatter.logTransaction);
    revalidatePath(ROUTES.chatter.home);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function deleteWhaleTransactionAction(recordId: string): Promise<ActionResult> {
  try {
    const user = await getSessionFromCookies();
    if (!user || user.role !== "chatter") {
      return { ok: false, error: "Unauthorized" };
    }
    const chatterId = user.airtableUserId ?? user.id;
    const before = await peekWhaleTransactionForChatter(recordId, chatterId);
    if (!before) {
      return { ok: false, error: "Unauthorized" };
    }
    await deleteWhaleTransactionForChatter(recordId, chatterId);
    const chatterName = (before.chatter_name || user.fullName || "Chatter").trim();
    const whaleName = (before.whale_username || "Whale").trim();
    const prev = Number(before.amount);
    const amountLabel = Number.isFinite(prev) ? prev.toFixed(2) : String(before.amount);
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.WHALE_SPENT,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "💰 Whale transaction modified",
      body: `${chatterName} deleted a transaction for ${whaleName}. Previous: $${amountLabel}`,
      entity_type: NOTIFICATION_ENTITY.WHALE,
      entity_id: recordId,
      actor_user_id: chatterId,
      actor_name: chatterName,
    }).catch(() => {});
    revalidatePath(ROUTES.chatter.logTransaction);
    revalidatePath(ROUTES.chatter.home);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
