"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/routes";
import { getSessionFromCookies } from "@/lib/auth";
import {
  deleteWhaleTransactionForChatter,
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
    await updateWhaleTransactionForChatter(recordId, chatterId, fields);
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
    await deleteWhaleTransactionForChatter(recordId, chatterId);
    revalidatePath(ROUTES.chatter.logTransaction);
    revalidatePath(ROUTES.chatter.home);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
