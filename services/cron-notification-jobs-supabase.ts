/**
 * Supabase backend helpers for services/cron-notification-jobs.ts
 *
 * Most of the aggregation logic in cron-notification-jobs already flows
 * through already-dual-backed services (users, va-tasks, custom-requests,
 * whales, weekly-availability-requests, model-personal-events, notifications).
 * Only two spots do direct Airtable I/O:
 *   - runPersonalEventReminders → updates `model_personal_events.reminder_sent`
 *   - runPhaseOverdueCheck      → reads/writes `va_task_phases` +
 *                                 reads `va_task_phase_items`
 */

import { notify, notifyAdmins } from "@/services/notification-service";
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_EVENT,
  NOTIFICATION_PRIORITY,
} from "@/lib/notification-types";
import {
  publicId,
  sbSelectAll,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";

// ------------------------------------------------------------------
// runPersonalEventReminders (Supabase side)
// ------------------------------------------------------------------

export async function markPersonalEventReminderSent(eventId: string): Promise<void> {
  await sbUpdateByPublicId("model_personal_events", eventId, { reminder_sent: true }).catch(() => {});
}

// ------------------------------------------------------------------
// runPhaseOverdueCheck (Supabase side)
// ------------------------------------------------------------------

type PhaseRow = SbRow & {
  phase_id?: string | null;
  scheduled_time?: string | null;
  status?: string | null;
  title?: string | null;
  assigned_va_id?: string | null;
};

type PhaseItemRow = SbRow & {
  phase_id?: string | null;
  status?: string | null;
};

export async function runPhaseOverdueCheck(): Promise<{
  ok: true;
  phases_marked: number;
  notifications_sent: number;
}> {
  let phases_marked = 0;
  let notifications_sent = 0;
  try {
    const phases = await sbSelectAll<PhaseRow>("va_task_phases").catch(() => []);
    const pending = phases.filter(
      (p) => (p.status ?? "").toLowerCase() === "pending" && (p.scheduled_time ?? "").trim() !== ""
    );
    if (pending.length === 0) return { ok: true, phases_marked, notifications_sent };

    const allItems = await sbSelectAll<PhaseItemRow>("va_task_phase_items").catch(() => []);
    const itemsByPhaseKey = new Map<string, PhaseItemRow[]>();
    for (const item of allItems) {
      const key = String(item.phase_id ?? "").trim();
      if (!key) continue;
      const list = itemsByPhaseKey.get(key) ?? [];
      list.push(item);
      itemsByPhaseKey.set(key, list);
    }

    for (const phase of pending) {
      const scheduled = String(phase.scheduled_time ?? "").trim();
      if (!scheduled) continue;
      const tMs = new Date(scheduled).getTime();
      if (!Number.isFinite(tMs) || tMs > Date.now()) continue;

      const phaseKey = String(phase.phase_id ?? "").trim() || publicId(phase);
      const items = itemsByPhaseKey.get(phaseKey) ?? [];
      const allDone =
        items.length > 0 &&
        items.every((i) => String(i.status ?? "").toLowerCase() === "completed");
      if (allDone) continue;

      await sbUpdateByPublicId("va_task_phases", publicId(phase), { status: "overdue" }).catch(
        () => {}
      );
      phases_marked += 1;

      const phaseTitle = String(phase.title ?? "Phase");
      const vaId = String(phase.assigned_va_id ?? "").trim();
      const phaseIdForNotify = publicId(phase);

      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.PHASE_OVERDUE,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "⚠️ Phase overdue",
        body: `"${phaseTitle}" deadline passed with incomplete items.`,
        entity_type: NOTIFICATION_ENTITY.VA_TASK_PHASE,
        entity_id: phaseIdForNotify,
      }).catch(() => {});
      notifications_sent += 1;

      if (vaId) {
        await notify({
          user_id: vaId,
          event_type: NOTIFICATION_EVENT.PHASE_OVERDUE,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: `⚠️ Phase overdue: ${phaseTitle}`,
          body: `The deadline for "${phaseTitle}" has passed. Please complete remaining items.`,
          entity_type: NOTIFICATION_ENTITY.VA_TASK_PHASE,
          entity_id: phaseIdForNotify,
        }).catch(() => {});
        notifications_sent += 1;
      }
    }

    return { ok: true, phases_marked, notifications_sent };
  } catch (e) {
    console.error("[runPhaseOverdueCheck/supabase]", e);
    return { ok: true, phases_marked, notifications_sent };
  }
}
