"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { deleteRecord } from "@/lib/airtable-server";
import { getDeleteBlockReasonsForModel } from "@/services/accounts-delete";
import { getModelById, updateModel } from "@/services/modelss";

/** Next.js redirect() throws; re-throw so redirect is not treated as a normal error. */
function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

/** Admin only: toggle model status between active and inactive. */
export async function toggleModelStatus(recordId: string) {
  const user = await getSessionFromCookies();
  if (user?.role !== "admin") return { error: "Unauthorized" };

  const model = await getModelById(recordId);
  if (!model) return { error: "Model not found" };

  const nextStatus = model.status === "active" ? "inactive" : "active";
  await updateModel(recordId, { status: nextStatus });
  return { success: true };
}

/** Admin only: delete model after checking linked records. Blocks if any references exist. */
export async function deleteModelAction(recordId: string) {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const id = recordId?.trim();
  if (!id) {
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent("Missing model record") + "&section=modelss");
    return;
  }
  try {
    const check = await getDeleteBlockReasonsForModel(id);
    if (!check.canDelete) {
      redirect(ROUTES.accounts + "?error=" + encodeURIComponent(check.summary) + "&section=modelss");
      return;
    }
    await deleteRecord("modelss", id);
    revalidatePath(ROUTES.accounts);
    redirect(ROUTES.accounts + "?success=model_deleted&section=modelss");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[deleteModelAction] error", err);
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent(message || "Failed to delete model") + "&section=modelss");
  }
}
