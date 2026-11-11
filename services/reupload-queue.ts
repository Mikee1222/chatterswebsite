/**
 * Reupload queue — notify the VAs assigned to a model that a trial-grid outlier
 * must be reuploaded (same file) to the main grid. No posting brief is involved.
 * Server-only (kept out of services/winner-sourcing, which client components import).
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { notify } from "@/services/notification-service";
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_EVENT,
  NOTIFICATION_PRIORITY,
} from "@/lib/notification-types";
import { getAssignedVaIdsForModel } from "@/services/posting-briefs";
import { getWinnerSubmission } from "@/services/winner-sourcing";

export async function notifyReuploadToAssignedVas(input: {
  queue_item_id: string;
  actor_id: string;
}): Promise<{ notified: number; notified_at: string }> {
  const sb = getSupabaseServiceClient();
  const { data: row, error } = await sb
    .from("recreation_queue_items")
    .select("*")
    .eq("id", input.queue_item_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Queue item not found");
  const item = row as { decision?: string; bunch_id?: string | null; winner_submission_id: string };
  if (item.decision !== "grid" || item.bunch_id) {
    throw new Error("This item is not in the reupload queue");
  }
  const sub = await getWinnerSubmission(String(item.winner_submission_id));
  if (!sub) throw new Error("Submission not found");

  const vaIds = (await getAssignedVaIdsForModel(sub.model_id)).filter(
    (id) => id && id !== input.actor_id,
  );
  if (!vaIds.length) {
    throw new Error(
      `No VA is assigned to ${sub.model_name || "this model"}'s social accounts — assign one in Marketing first.`,
    );
  }

  const multiple = sub.outlier_multiple != null ? ` ×${sub.outlier_multiple}` : "";
  const title = `Reupload to MAIN grid: ${sub.model_name || "model"}`;
  const body = `Trial outlier${multiple} — post the SAME file to the main grid (no new edit). Trial post: ${sub.video_link}`;

  await Promise.all(
    vaIds.map((user_id) =>
      notify({
        user_id,
        event_type: NOTIFICATION_EVENT.POSTING_BRIEF_PUBLISHED,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title,
        body,
        entity_type: NOTIFICATION_ENTITY.POSTING_BRIEF,
        entity_id: "",
        actor_user_id: input.actor_id,
        _triggerSource: "reupload_queue_notify",
      }).catch((err) => console.error("[reupload_queue_notify] notify failed", err)),
    ),
  );

  const notified_at = new Date().toISOString();
  // Best effort: the column is added by migration 20261111170000; ignore if absent.
  const { error: upErr } = await sb
    .from("recreation_queue_items")
    .update({ reupload_notified_at: notified_at })
    .eq("id", input.queue_item_id);
  if (upErr) console.warn("[reupload_queue_notify] could not stamp reupload_notified_at:", upErr.message);

  return { notified: vaIds.length, notified_at };
}
