"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/routes";
import { updateWhale, type WhaleWriteFields } from "@/services/whales";

export type AssignWhaleResult = { success: true } | { success: false; error: string };

export async function assignWhaleToChatter(
  whaleRecordId: string,
  chatterRecordId: string,
  chatterName: string
): Promise<AssignWhaleResult> {
  try {
    await updateWhale(whaleRecordId, {
      assigned_chatter: [chatterRecordId],
      assigned_chatter_name: chatterName,
    });
    revalidatePath(ROUTES.admin.whales);
    revalidatePath(ROUTES.chatter.myWhales);
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
    await updateWhale(whaleRecordId, {
      assigned_model: [modelRecordId],
      assigned_model_name: modelName,
    });
    revalidatePath(ROUTES.admin.whales);
    revalidatePath(ROUTES.chatter.myWhales);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/** Clear assigned model from a whale. */
export async function clearWhaleModel(whaleRecordId: string): Promise<AssignWhaleResult> {
  try {
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
    await updateWhale(whaleRecordId, {
      assigned_chatter: [],
      assigned_chatter_name: "",
    });
    revalidatePath(ROUTES.admin.whales);
    revalidatePath(ROUTES.chatter.myWhales);
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
    await updateWhale(whaleRecordId, fields);
    revalidatePath(ROUTES.admin.whales);
    revalidatePath(ROUTES.chatter.myWhales);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
