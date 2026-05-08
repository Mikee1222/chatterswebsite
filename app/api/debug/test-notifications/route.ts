import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import {
  isNotificationTestingEnabled,
  type NotificationTestUserOption,
} from "@/lib/notification-test-presets";
import { notify } from "@/services/notification-service";
import { listAllUsers } from "@/services/users";
import type { NotificationEventType } from "@/types";

const postBodySchema = z.object({
  event_type: z.string().min(1),
  user_id: z.string().min(1),
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  entity_type: z.string().min(1).optional(),
  entity_id: z.string().min(1).optional(),
});

function isValidEventType(v: string): v is NotificationEventType {
  /** Keep in sync with `NotificationEventType` union; rejects unknown strings before Airtable write. */
  const allowed = new Set<string>([
    "shift_started",
    "shift_ended",
    "shift_late",
    "shift_no_show",
    "shift_overtime",
    "shift_running_long",
    "shift_starting_soon",
    "chatter_no_models",
    "break_started",
    "break_ended",
    "break_exceeded",
    "break_too_long",
    "model_became_free",
    "model_taken",
    "model_live_started",
    "model_live_ended",
    "model_live_scheduled",
    "model_missed_live",
    "model_content_completed",
    "model_content_scheduled",
    "va_content_assigned",
    "period_3_day_reminder",
    "period_predicted_day",
    "period_confirmed_early",
    "period_overdue",
    "period_prediction_reset",
    "task_shift_started",
    "task_shift_ended",
    "task_started",
    "task_finished",
    "task_completed",
    "task_overdue",
    "tasks_not_started",
    "va_task_reminder",
    "custom_request_created",
    "custom_request_updated",
    "custom_request_submitted",
    "custom_status_changed",
    "custom_approved",
    "custom_rejected",
    "custom_declined",
    "custom_edited",
    "custom_uploaded",
    "custom_scheduled",
    "custom_deadline_approaching",
    "custom_overdue",
    "form_submitted",
    "schedule_updated",
    "weekly_availability_friday_reminder",
    "availability_submitted",
    "whale_registered",
    "whale_assigned",
    "whale_followup",
    "whale_spent",
    "whale_session_submitted",
    "system_alert",
    "account_update",
    "user_created",
    "role_changed",
    "account_deleted",
    "daily_summary",
    "points_awarded",
    "level_up",
    "spin_available",
    "challenge_completed",
  ]);
  return allowed.has(v);
}

async function assertAdminAndTestingEnabled(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  if (!isNotificationTestingEnabled()) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true };
}

/**
 * GET — list users for recipient dropdowns (admin-only; disabled in production unless
 * `ENABLE_NOTIFICATION_TESTING=true`).
 */
export async function GET() {
  const gate = await assertAdminAndTestingEnabled();
  if (!gate.ok) return gate.response;

  const users = await listAllUsers().catch(() => []);
  const options: NotificationTestUserOption[] = users
    .filter((u) => u.id)
    .map((u) => ({
      id: u.id,
      full_name: (u.full_name ?? "").trim() || "—",
      email: (u.email ?? "").trim() || "—",
      role: u.role,
      status: (u.status ?? "").trim() || "—",
    }));

  return NextResponse.json({ users: options });
}

/**
 * POST — send one `notify()` with arbitrary payload (admin-only; production gated).
 */
export async function POST(req: Request) {
  const gate = await assertAdminAndTestingEnabled();
  if (!gate.ok) return gate.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { event_type, user_id, title, body, entity_type, entity_id } = parsed.data;
  if (!isValidEventType(event_type)) {
    return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
  }

  const entityId = entity_id?.trim() || `debug_test:${event_type}:${Date.now()}`;
  const titleFinal = title?.trim() || `TEST: ${event_type}`;
  const bodyFinal = body?.trim() || `Manual test for "${event_type}".`;
  const entityTypeFinal = entity_type?.trim() || "system";

  try {
    const result = await notify({
      user_id: user_id.trim(),
      event_type,
      title: titleFinal,
      body: bodyFinal,
      entity_type: entityTypeFinal,
      entity_id: entityId,
      _triggerSource: "api/debug/test-notifications",
    });
    return NextResponse.json({
      success: true,
      sent_to: user_id.trim(),
      event_type,
      notification_id: result.notification?.id ?? null,
      push_sent: result.pushSent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
