import { NextResponse } from "next/server";
import { runCheckLateShifts } from "@/services/check-late-shifts";
import { runCustomRequestOverdue48hAdminAlerts } from "@/services/custom-requests";
import { runModelLiveScheduledReminders } from "@/services/model-live-scheduled-reminders";
import {
  runSundayAvailabilityReminders,
  runFridayWeeklyAvailabilityReminders,
  runCustomDeadlinesWithin48Hours,
  runVaTaskReminders,
  runVaTaskOverdueEscalation,
  runVaRecurringTaskSpawner,
  runVaTodayRecurringOccurrenceSpawner,
  runStuckCustomRequestAlerts,
  runPersonalEventReminders,
  runPhaseOverdueCheck,
} from "@/services/cron-notification-jobs";
import { runMaterialUntilApproachingAlerts } from "@/services/icloud";

/**
 * Auth: when CRON_SECRET is set, require Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 * When CRON_SECRET is not set (e.g. dev), allow so manual and cron Worker can call without secret.
 * Cloudflare Cron Trigger uses a separate Worker that calls this URL with x-cron-secret.
 */
function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret === cronSecret) return true;
  return false;
}

/**
 * GET /api/cron/check-late-shifts
 * Runs late/no-show checks, Friday (GMT+3) weekly availability reminders, Sunday availability
 * reminders, custom deadline (48h) alerts, custom requests stale 48h+ (admin), and VA task due
 * reminders (next 60 min window; cron every ~15 min), and model live stream 30‑minute reminders.
 * Used by workers/cron-late-shifts and manual calls.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [
      lateShifts,
      availabilityReminders,
      fridayAvailabilityReminders,
      customDeadlines48h,
      customOverdue48h,
      vaTaskReminders,
      vaTaskOverdueEscalation,
      vaRecurringSpawn,
      vaTodayRecurringSpawn,
      stuckCustomRequestAlerts,
      personalEventReminders,
      modelLiveScheduledReminders,
      phaseOverdue,
      materialUntilApproaching,
    ] = await Promise.all([
      runCheckLateShifts(),
      runSundayAvailabilityReminders(),
      runFridayWeeklyAvailabilityReminders(),
      runCustomDeadlinesWithin48Hours(),
      runCustomRequestOverdue48hAdminAlerts(),
      runVaTaskReminders(),
      runVaTaskOverdueEscalation(),
      runVaRecurringTaskSpawner(),
      runVaTodayRecurringOccurrenceSpawner(),
      runStuckCustomRequestAlerts(),
      runPersonalEventReminders(),
      runModelLiveScheduledReminders(),
      runPhaseOverdueCheck(),
      runMaterialUntilApproachingAlerts().catch((err) => {
        console.error("[cron] material_until_approaching", err);
        return { ok: true as const, folders_scanned: 0, notifications_sent: 0 };
      }),
    ]);
    return NextResponse.json({
      ...lateShifts,
      availability_reminders: availabilityReminders,
      friday_availability_reminders: fridayAvailabilityReminders,
      custom_deadlines_48h: customDeadlines48h,
      custom_overdue_48h: customOverdue48h,
      va_task_reminders: vaTaskReminders,
      va_task_overdue_escalation: vaTaskOverdueEscalation,
      va_recurring_spawn: vaRecurringSpawn,
      va_today_recurring_spawn: vaTodayRecurringSpawn,
      stuck_custom_request_alerts: stuckCustomRequestAlerts,
      personal_event_reminders: personalEventReminders,
      model_live_scheduled_reminders: modelLiveScheduledReminders,
      phase_overdue: phaseOverdue,
      material_until_approaching: materialUntilApproaching,
    });
  } catch (err) {
    console.error("[cron/check-late-shifts]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Check failed" },
      { status: 500 }
    );
  }
}
