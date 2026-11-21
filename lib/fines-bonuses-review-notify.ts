/**
 * Deferred chatter notification after approve — waits 5s then re-checks status
 * so Undo (revert to pending_review) cancels the notify without schema changes.
 */

import { fineBonusReviewedPersonal } from "@/lib/notification-copy";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { getFineBonusById } from "@/services/fines-bonuses";
import { notifyByRoleConfig } from "@/services/notification-service";

const DEFER_MS = 5_000;

export type DeferredReviewNotifyInput = {
  recordId: string;
  adminId: string;
  adminName: string;
  decision: "Approved" | "Rejected";
  chatterName: string;
  personalUserId: string;
};

async function sendIfStillApproved(input: DeferredReviewNotifyInput): Promise<void> {
  await new Promise((r) => setTimeout(r, DEFER_MS));
  try {
    const record = await getFineBonusById(input.recordId);
    if (!record) return;
    if (record.status !== "approved") return;
    if (record.admin_id !== input.adminId) return;

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
  } catch (err) {
    console.error("[scheduleDeferredApprovedNotification]", err);
  }
}

function attachWaitUntil(task: Promise<void>): void {
  void import("@opennextjs/cloudflare")
    .then((mod) => {
      try {
        mod.getCloudflareContext().ctx.waitUntil(task);
      } catch {
        void task;
      }
    })
    .catch(() => {
      void task;
    });
}

/** Prefer CF waitUntil when available; otherwise fire-and-forget (local/dev). */
export function scheduleDeferredApprovedNotification(input: DeferredReviewNotifyInput): void {
  attachWaitUntil(sendIfStillApproved(input));
}

export async function sendReviewNotificationImmediate(input: {
  recordId: string;
  adminId: string;
  adminName: string;
  decision: "Approved" | "Rejected";
  chatterName: string;
  personalUserId: string;
}): Promise<void> {
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
