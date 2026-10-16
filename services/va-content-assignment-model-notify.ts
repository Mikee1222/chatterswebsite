/**
 * Notify the linked model user once when chatting content becomes available to them.
 * Used by admin create, VA create, and legacy approve paths (one notify per assignment row).
 */
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { notify } from "@/services/notification-service";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";

export async function notifyModelOfContentAssignment(input: {
  modelRecordId: string;
  assignmentId: string;
  title: string;
  actorUserId?: string | null;
  actorName?: string | null;
  /** Distinguishes create vs legacy approve in logs. */
  triggerSource: string;
}): Promise<{ notified: boolean; modelUserId: string | null }> {
  const modelRecordId = input.modelRecordId?.trim();
  const assignmentId = input.assignmentId?.trim();
  if (!modelRecordId || !assignmentId) {
    return { notified: false, modelUserId: null };
  }

  const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(modelRecordId).catch(
    () => null
  );
  if (!modelUserId) {
    return { notified: false, modelUserId: null };
  }

  const displayTitle = input.title.trim() || "Chatting content assignment";
  await notify({
    user_id: modelUserId,
    event_type: NOTIFICATION_EVENT.MODEL_CONTENT_ASSIGNED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "📋 New Chatting Assignment",
    body: `${displayTitle} is ready for you. Open Chatting Assignments to schedule it.`,
    entity_type: "va_content_assignment",
    entity_id: assignmentId,
    actor_user_id: input.actorUserId?.trim() || undefined,
    actor_name: input.actorName?.trim() || undefined,
    _triggerSource: input.triggerSource,
  });

  return { notified: true, modelUserId };
}
