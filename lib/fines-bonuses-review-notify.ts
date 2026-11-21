/**
 * Immediate chatter notifications for extra-revenue review / undo.
 * No deferred timers and no Cloudflare waitUntil — safe on any serverless runtime.
 */

import {
  fineBonusReviewedPersonal,
  fineBonusReviewRevertedPersonal,
} from "@/lib/notification-copy";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { notifyByRoleConfig } from "@/services/notification-service";

export type ReviewNotifyInput = {
  recordId: string;
  adminId: string;
  adminName: string;
  chatterName: string;
  personalUserId: string;
};

export async function sendReviewDecisionNotification(
  input: ReviewNotifyInput & { decision: "Approved" | "Rejected" }
): Promise<void> {
  const copy = fineBonusReviewedPersonal(input.decision, input.adminName);
  await notifyByRoleConfig(NOTIFICATION_EVENT.FINE_BONUS_REVIEWED, {
    personal_user_id: input.personalUserId,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: copy.title,
    body: copy.body,
    entity_type: NOTIFICATION_ENTITY.FINE_BONUS,
    entity_id: input.recordId,
    actor_user_id: input.adminId,
    actor_name: input.adminName,
    context: {
      decision: input.decision,
      adminName: input.adminName,
      chatterName: input.chatterName,
    },
  }).catch(() => {});
}

/** Corrective notify after Undo — approval notification was already sent. */
export async function sendReviewRevertedNotification(input: ReviewNotifyInput): Promise<void> {
  const copy = fineBonusReviewRevertedPersonal(input.adminName);
  await notifyByRoleConfig(NOTIFICATION_EVENT.FINE_BONUS_REVIEWED, {
    personal_user_id: input.personalUserId,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: copy.title,
    body: copy.body,
    entity_type: NOTIFICATION_ENTITY.FINE_BONUS,
    entity_id: input.recordId,
    actor_user_id: input.adminId,
    actor_name: input.adminName,
    context: {
      decision: "Reverted",
      adminName: input.adminName,
      chatterName: input.chatterName,
    },
  }).catch(() => {});
}
