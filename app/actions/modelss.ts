"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getModelById, updateModel } from "@/services/modelss";
import { forceDeleteModel } from "@/services/force-delete-cascade";

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

/** Admin only: force-delete model (cascade). Returns JSON-friendly result (no redirect). */
export async function deleteModelForAdmin(
  recordId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }
  const id = recordId?.trim();
  if (!id) {
    return { success: false, error: "Missing model record." };
  }
  try {
    await forceDeleteModel(id);
    revalidatePath(ROUTES.admin.models);
    revalidatePath(ROUTES.accounts);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[deleteModelForAdmin] error", err);
    return { success: false, error: message || "Failed to delete model." };
  }
}

/** Admin only: force-delete model and cascade linked rows (best-effort). */
export async function deleteModelAction(recordId: string) {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const id = recordId?.trim();
  if (!id) {
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent("Missing model record") + "&section=modelss");
    return;
  }
  try {
    await forceDeleteModel(id);
    revalidatePath(ROUTES.admin.models);
    revalidatePath(ROUTES.accounts);
    redirect(ROUTES.accounts + "?success=model_deleted&section=modelss");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[deleteModelAction] error", err);
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent(message || "Failed to delete model") + "&section=modelss");
  }
}

/**
 * Admin only: `modelss.period_tracking_enabled` (checkbox).
 * Managers cannot change this — matches other admin-only model controls.
 */
export async function setModelPeriodTrackingEnabledAction(
  recordId: string,
  enabled: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getSessionFromCookies();
  if (user?.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }
  const id = recordId?.trim();
  if (!id) return { success: false, error: "Missing model id." };
  const model = await getModelById(id);
  if (!model) return { success: false, error: "Model not found." };
  try {
    await updateModel(id, { period_tracking_enabled: enabled });
    revalidatePath(ROUTES.admin.models);
    revalidatePath(ROUTES.admin.modelDetail(id));
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message || "Update failed." };
  }
}
