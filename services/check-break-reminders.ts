"use server";

import { listShiftsOnBreak, updateShift } from "@/services/shifts";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

/**
 * How far past `break_reminder_at` we still send a push. Must cover gaps between cron runs
 * (worker runs every five minutes) so we do not miss the reminder; stale rows older than this are cleared silently.
 */
const REMINDER_FIRE_LOOKBACK_MS = 12 * 60 * 1000;

export type CheckBreakRemindersResult = {
  ok: true;
  checked: number;
  sent: number;
  cleared_stale: number;
};

export async function runCheckBreakReminders(): Promise<CheckBreakRemindersResult> {
  const shifts = await listShiftsOnBreak();
  const now = Date.now();
  let sent = 0;
  let clearedStale = 0;

  for (const shift of shifts) {
    const raw = shift.break_reminder_at;
    if (!raw || typeof raw !== "string") continue;

    const reminderMs = new Date(raw).getTime();
    if (Number.isNaN(reminderMs)) {
      await updateShift(shift.id, { break_reminder_at: "" }).catch(() => {});
      clearedStale++;
      continue;
    }

    if (reminderMs > now) continue;

    if (reminderMs < now - REMINDER_FIRE_LOOKBACK_MS) {
      await updateShift(shift.id, { break_reminder_at: "" }).catch(() => {});
      clearedStale++;
      continue;
    }

    if (shift.chatter_id) {
      try {
        /** Use `shift_starting_soon` so category is `shift` (same push prefs as shift alerts); Airtable stores `system_alert`. */
        await notify({
          user_id: shift.chatter_id,
          event_type: NOTIFICATION_EVENT.SHIFT_STARTING_SOON,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: "⏰ Break reminder",
          body: "⏰ Your break is ending soon — time to get back to work!",
          entity_type: NOTIFICATION_ENTITY.SHIFT,
          entity_id: `break_reminder:${shift.id}:${raw}`,
          _triggerSource: "break_reminder_cron",
        });
        sent++;
      } catch (e) {
        console.error("[check-break-reminders] notify failed", e);
      }
    }

    await updateShift(shift.id, { break_reminder_at: "" }).catch(() => {});
  }

  return { ok: true, checked: shifts.length, sent, cleared_stale: clearedStale };
}
