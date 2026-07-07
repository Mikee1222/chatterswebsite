#!/usr/bin/env npx tsx
/**
 * verify-all-notifications.ts
 * ----------------------------------------------------------------------------
 * Automated end-to-end verification that every wired notification event type
 * actually produces an Airtable `notifications` record with:
 *   - the CORRECT event_type (matching lib/notifications-schema EVENT_TYPE_TO_AIRTABLE,
 *     NOT an accidental `system_alert` fallback and NOT missing),
 *   - the CORRECT recipient user_id,
 *   - a non-empty title AND body.
 *
 * HOW IT WORKS
 *   1. Creates a throwaway recipient user (prefixed TEST_VERIFY_NOTIF_) with NO
 *      notification_preferences row, so `notify()` never gates the in-app record.
 *   2. FLAGSHIP SERVICE FLOWS — calls the real service functions end-to-end
 *      (winner videos, creative scripts, spot checks) with TEST_VERIFY_NOTIF_
 *      records, proving the service → notify() wiring for the recently-audited
 *      surfaces (e.g. approveWinnerVideo()).
 *   3. NOTIFY-PATH CHECKS — for events fired inline from API routes / actions,
 *      invokes the exact same `notify()` call the production code makes with the
 *      real source event_type + representative copy, verifying the event_type
 *      mapping and record creation.
 *   4. CRON EVENTS — events that only ever fire from a scheduled job / time-based
 *      condition (whale_followup, model_missed_live, shift_late, …) are marked
 *      NOT-DIRECTLY-TESTABLE. Their event_type→Airtable mapping is still sanity
 *      checked via the notify() path and reported as such.
 *   5. After every trigger it queries the notifications table by entity_id and
 *      records PASS / FAIL per event.
 *   6. CLEANUP (idempotent, always runs in `finally`): deletes every notification
 *      record it created (captured ids + a TEST_VERIFY_NOTIF_ entity_id sweep),
 *      the flagship source records, and the throwaway user. Safe to re-run.
 *
 * USAGE
 *   npx tsx scripts/verify-all-notifications.ts
 *
 * Requires `.env` / `.env.local` with AIRTABLE_TOKEN + AIRTABLE_BASE_ID
 * (base `Chatting` / appfCUBei2fna7I1u). VERIFICATION ONLY — does not modify any
 * notification logic or copy.
 */
import "dotenv/config";

import {
  listRecords,
  listAllRecords,
  createRecord,
  updateRecord,
  deleteRecord,
} from "@/lib/airtable-server";
import {
  NOTIFICATIONS_TABLE,
  NOTIFICATION_FIELDS,
  EVENT_TYPE_TO_AIRTABLE,
  NOTIFICATION_EVENT_TYPES,
} from "@/lib/notifications-schema";
import { NOTIFICATION_EVENTS_WITH_ADMIN_VARIANT } from "@/lib/notification-admin-variants";
import { notify } from "@/services/notification-service";
import {
  createWinnerVideo,
  approveWinnerVideo,
  rejectWinnerVideo,
  submitCreativeScript,
  approveCreativeScript,
  rejectCreativeScript,
  resubmitCreativeScript,
} from "@/services/winner-videos";
import { createSpotCheck, updateSpotCheck, deleteSpotCheck } from "@/services/marketing-reviews";
import { listUsersWithPermission } from "@/services/users";
import { PERMISSIONS } from "@/lib/permissions";
import type { NotificationEventType } from "@/types";

// ----------------------------------------------------------------------------
// Config / constants
// ----------------------------------------------------------------------------
const USERS_TABLE = "users";
const WINNER_VIDEOS_TABLE = "winner_videos";
const SPOT_CHECKS_TABLE = "marketing_spot_checks";

/** Marker embedded in every test entity_id so leftovers can be swept idempotently. */
const SWEEP_TAG = "TEST_VERIFY_NOTIF";
const RUN_TAG = `${SWEEP_TAG}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

type Method = "service" | "notify" | "cron";
type Status = "PASS" | "FAIL" | "NOT-DIRECTLY-TESTABLE";

interface Result {
  event: string;
  airtableEventType: string;
  method: Method;
  status: Status;
  detail: string;
}

const results: Result[] = [];
/** Airtable record ids of notifications we created — deleted during cleanup. */
const createdNotificationRecordIds = new Set<string>();
/** Flagship source records to delete during cleanup. */
const createdWinnerVideoIds = new Set<string>();
const createdSpotCheckIds = new Set<string>();
let testUserRecordId = "";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function expectedAirtable(source: string): string {
  return EVENT_TYPE_TO_AIRTABLE[source] ?? source;
}

function nextEntityId(source: string): string {
  return `${RUN_TAG}:${source}:${Math.random().toString(36).slice(2, 8)}`;
}

// ----------------------------------------------------------------------------
// Verification: query notifications by entity_id and assert correctness
// ----------------------------------------------------------------------------
type FoundNotif = {
  recordId: string;
  event_type: string;
  user_id: string;
  title: string;
  body: string;
};

async function findNotificationsByEntityId(entityId: string): Promise<FoundNotif[]> {
  const escaped = entityId.replace(/"/g, '""');
  const formula = `{${NOTIFICATION_FIELDS.entity_id}} = "${escaped}"`;
  // Retry a few times — Airtable REST is read-your-write but allow for propagation.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { records } = await listRecords<Record<string, unknown>>(NOTIFICATIONS_TABLE, {
      filterByFormula: formula,
      pageSize: 50,
    });
    if (records.length > 0) {
      return records.map((r) => {
        const f = r.fields as Record<string, unknown>;
        createdNotificationRecordIds.add(r.id);
        return {
          recordId: r.id,
          event_type: String(f[NOTIFICATION_FIELDS.event_type] ?? ""),
          user_id: String(f[NOTIFICATION_FIELDS.user_id] ?? ""),
          title: String(f[NOTIFICATION_FIELDS.title] ?? ""),
          body: String(f[NOTIFICATION_FIELDS.body] ?? ""),
        };
      });
    }
    await sleep(700);
  }
  return [];
}

/**
 * Assert a single notification exists for `entityId` with the correct mapping,
 * recipient, and non-empty copy. `expectedUserId` may be null for broadcast
 * (permission-holder) events where the recipient is not the test user.
 */
async function verify(params: {
  event: string;
  method: Method;
  entityId: string;
  expectedUserId: string | null;
  /** For broadcast events: number of real recipients (0 → no record expected). */
  expectedRecipientCount?: number;
  markCron?: boolean;
}): Promise<void> {
  const { event, method, entityId, expectedUserId } = params;
  const expected = expectedAirtable(event);
  const found = await findNotificationsByEntityId(entityId);

  const baseStatus: Status = params.markCron ? "NOT-DIRECTLY-TESTABLE" : "PASS";

  if (found.length === 0) {
    if ((params.expectedRecipientCount ?? -1) === 0) {
      results.push({
        event,
        airtableEventType: expected,
        method,
        status: params.markCron ? "NOT-DIRECTLY-TESTABLE" : "PASS",
        detail: "service ran; no eligible recipients configured in this base (no record expected)",
      });
      return;
    }
    results.push({
      event,
      airtableEventType: expected,
      method,
      status: "FAIL",
      detail: "no notification record created for entity_id",
    });
    return;
  }

  // When multiple notifications share the same entity_id (e.g. approveWinnerVideo fires
  // winner_video_approved AND research_assigned_to_creative), match by expected event_type.
  let candidates = found.filter((f) => f.event_type === expected);
  if (expectedUserId != null) {
    const byUserAndType = candidates.filter((f) => f.user_id === expectedUserId);
    if (byUserAndType.length > 0) candidates = byUserAndType;
  }
  if (candidates.length === 0) {
    results.push({
      event,
      airtableEventType: expected,
      method,
      status: "FAIL",
      detail: `no notification with event_type "${expected}" for entity_id (found: ${found.map((f) => f.event_type).join(", ")})`,
    });
    return;
  }
  const rec = candidates[0];

  const problems: string[] = [];
  if (!NOTIFICATION_EVENT_TYPES.includes(rec.event_type as (typeof NOTIFICATION_EVENT_TYPES)[number])) {
    problems.push(`event_type "${rec.event_type}" is not a registered Airtable option`);
  }
  if (!rec.title.trim()) problems.push("empty title");
  if (!rec.body.trim()) problems.push("empty body");
  if (expectedUserId != null && rec.user_id !== expectedUserId) {
    problems.push(`user_id "${rec.user_id}" != expected "${expectedUserId}"`);
  }
  if (!rec.user_id.trim()) problems.push("empty user_id");

  if (problems.length > 0) {
    results.push({
      event,
      airtableEventType: expected,
      method,
      status: "FAIL",
      detail: problems.join("; "),
    });
    return;
  }

  results.push({
    event,
    airtableEventType: expected,
    method,
    status: baseStatus,
    detail:
      (params.markCron ? "cron/env event — mapping+copy verified via notify(); " : "") +
      `record ok (event_type="${rec.event_type}", user_id ok, title/body non-empty)`,
  });
}

// ----------------------------------------------------------------------------
// Notify-path trigger: fire the exact notify() call, then verify
// ----------------------------------------------------------------------------
async function checkNotify(params: {
  event: NotificationEventType;
  entityType: string;
  method: Method;
  markCron?: boolean;
}): Promise<void> {
  const entityId = nextEntityId(params.event);
  const title = `[TEST_VERIFY] ${params.event}`;
  const body = `Automated verification trigger for "${params.event}".`;
  try {
    await notify({
      user_id: testUserRecordId,
      event_type: params.event,
      title,
      body,
      entity_type: params.entityType,
      entity_id: entityId,
      _triggerSource: "scripts/verify-all-notifications",
    });
  } catch (err) {
    results.push({
      event: params.event,
      airtableEventType: expectedAirtable(params.event),
      method: params.method,
      status: "FAIL",
      detail: `notify() threw: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }
  await verify({
    event: params.event,
    method: params.method,
    entityId,
    expectedUserId: testUserRecordId,
    markCron: params.markCron,
  });
}

// ----------------------------------------------------------------------------
// Registry of notify-path + cron events (base source event types)
// ----------------------------------------------------------------------------
type RegEntry = { event: NotificationEventType; entityType: string; cron?: boolean };

const NOTIFY_EVENTS: RegEntry[] = [
  // —— Shifts ——
  { event: "shift_started", entityType: "shift" },
  { event: "shift_ended", entityType: "shift" },
  { event: "break_started", entityType: "shift" },
  { event: "break_ended", entityType: "shift" },
  { event: "shift_late", entityType: "shift", cron: true },
  { event: "shift_no_show", entityType: "shift", cron: true },
  { event: "shift_overtime", entityType: "shift", cron: true },
  { event: "shift_running_long", entityType: "shift", cron: true },
  { event: "shift_starting_soon", entityType: "shift", cron: true },
  { event: "chatter_no_models", entityType: "shift", cron: true },
  { event: "break_exceeded", entityType: "shift", cron: true },
  { event: "break_too_long", entityType: "shift", cron: true },

  // —— Tasks / VA / phases ——
  { event: "task_started", entityType: "task_shift" },
  { event: "task_finished", entityType: "task_shift" },
  { event: "task_shift_started", entityType: "task_shift" },
  { event: "task_shift_ended", entityType: "task_shift" },
  { event: "task_completed", entityType: "va_task" },
  { event: "va_task_assigned", entityType: "va_task" },
  { event: "phase_task_completed", entityType: "va_task_phase_item" },
  { event: "phase_completed", entityType: "va_task_phase" },
  { event: "all_phases_completed", entityType: "va_task" },
  { event: "task_overdue", entityType: "va_task", cron: true },
  { event: "tasks_not_started", entityType: "va_task", cron: true },
  { event: "va_task_reminder", entityType: "va_task", cron: true },
  { event: "phase_overdue", entityType: "va_task_phase", cron: true },

  // —— Models / content ——
  { event: "model_became_free", entityType: "model" },
  { event: "model_taken", entityType: "model" },
  { event: "model_live_started", entityType: "model_live_stream" },
  { event: "model_live_ended", entityType: "model_live_stream" },
  { event: "model_content_completed", entityType: "va_content_assignment" },
  { event: "model_content_scheduled", entityType: "va_content_assignment" },
  { event: "model_content_request_created", entityType: "model_content_request" },
  { event: "model_content_request_reviewed", entityType: "model_content_request" },
  { event: "va_content_assigned", entityType: "va_content_assignment" },
  { event: "va_content_scheduled", entityType: "va_content_assignment" },
  { event: "va_content_completed", entityType: "va_content_assignment" },
  { event: "custom_request_uploaded", entityType: "custom_request" },
  { event: "model_schedule_created", entityType: "model_schedule" },
  { event: "model_live_scheduled", entityType: "model_live_stream", cron: true },
  { event: "model_missed_live", entityType: "model_live_stream", cron: true },

  // —— Period ——
  { event: "period_confirmed_early", entityType: "model_period" },
  { event: "period_prediction_reset", entityType: "model_period" },
  { event: "period_3_day_reminder", entityType: "model_period", cron: true },
  { event: "period_predicted_day", entityType: "model_period", cron: true },
  { event: "period_overdue", entityType: "model_period", cron: true },

  // —— Whales ——
  { event: "whale_registered", entityType: "whale" },
  { event: "whale_assigned", entityType: "whale" },
  { event: "whale_spent", entityType: "whale" },
  { event: "whale_session_submitted", entityType: "whale" },
  { event: "whale_followup", entityType: "whale", cron: true },

  // —— Custom requests ——
  { event: "custom_request_created", entityType: "custom_request" },
  { event: "custom_request_updated", entityType: "custom_request" },
  { event: "custom_request_submitted", entityType: "custom_request" },
  { event: "custom_status_changed", entityType: "custom_request" },
  { event: "custom_approved", entityType: "custom_request" },
  { event: "custom_rejected", entityType: "custom_request" },
  { event: "custom_declined", entityType: "custom_request" },
  { event: "custom_edited", entityType: "custom_request" },
  { event: "custom_uploaded", entityType: "custom_request" },
  { event: "custom_scheduled", entityType: "custom_request" },
  { event: "custom_deadline_approaching", entityType: "custom_request", cron: true },
  { event: "custom_overdue", entityType: "custom_request", cron: true },

  // —— Mistakes ——
  { event: "chatter_mistake", entityType: "chatter_mistake" },
  { event: "chatter_mistake_reviewed", entityType: "chatter_mistake" },

  // —— Fines / bonuses / tips / rebills ——
  { event: "fine_issued", entityType: "fine_bonus" },
  { event: "bonus_awarded", entityType: "fine_bonus" },
  { event: "fine_bonus_reviewed", entityType: "fine_bonus" },
  { event: "tip_approved", entityType: "tip" },
  { event: "tip_rejected", entityType: "tip" },
  { event: "rebill_verified", entityType: "rebill" },
  { event: "rebill_rejected", entityType: "rebill" },

  // —— Marketing / shadowban ——
  { event: "shadowban_submitted", entityType: "account" },
  { event: "shadowban_resolved", entityType: "account" },
  { event: "shadowban_lifted_reported", entityType: "account" },
  { event: "shadowban_report", entityType: "account" },

  // —— SOP quiz / academy ——
  { event: "sop_quiz_passed", entityType: "sop_academy" },
  { event: "sop_quiz_failed", entityType: "sop_academy" },
  { event: "sop_academy_training_complete", entityType: "sop_academy" },
  { event: "sop_academy_signed_off", entityType: "sop_academy" },
  { event: "sop_academy_reminder", entityType: "sop_academy", cron: true },

  // —— Schedule / availability / weekly program ——
  { event: "schedule_published", entityType: "system" },
  { event: "schedule_updated", entityType: "system" },
  { event: "availability_submitted", entityType: "system" },
  { event: "weekly_availability_friday_reminder", entityType: "system", cron: true },

  // —— Rewards ——
  { event: "points_awarded", entityType: "points_transaction" },
  { event: "level_up", entityType: "chatter_points" },
  { event: "spin_available", entityType: "chatter_points" },
  { event: "challenge_completed", entityType: "challenge" },
  { event: "spin_result", entityType: "spin_wheel_spin" },

  // —— Billing ——
  { event: "billing_cycle_announced", entityType: "billing_cycle" },
  { event: "payment_submitted", entityType: "billing_cycle" },
  { event: "billing_payment_submitted", entityType: "billing_cycle" },
  { event: "payment_confirmed", entityType: "billing_cycle" },
  { event: "payment_rejected", entityType: "billing_cycle" },
  { event: "expense_approved", entityType: "expense_request" },
  { event: "expense_rejected", entityType: "expense_request" },
  { event: "billing_due_reminder", entityType: "billing_cycle", cron: true },

  // —— System ——
  { event: "system_alert", entityType: "system" },
  { event: "user_created", entityType: "account" },
  { event: "role_changed", entityType: "account" },
  { event: "account_deleted", entityType: "account" },
  { event: "account_update", entityType: "account" },
  { event: "login_new_device", entityType: "account" },
  { event: "password_changed", entityType: "account" },
  { event: "form_submitted", entityType: "form" },
  { event: "daily_summary", entityType: "system", cron: true },
];

// ----------------------------------------------------------------------------
// Flagship REAL service flows (proves service → notify wiring)
// ----------------------------------------------------------------------------
async function runWinnerVideoAndCreativeScriptFlow(): Promise<void> {
  let wvManageHolders = 0;
  let scriptManageHolders = 0;
  try {
    wvManageHolders = (await listUsersWithPermission(PERMISSIONS.WINNER_VIDEOS_MANAGE)).filter(
      (u) => u.id && u.id !== testUserRecordId
    ).length;
    scriptManageHolders = (await listUsersWithPermission(PERMISSIONS.CREATIVE_SCRIPTS_MANAGE)).filter(
      (u) => u.id && u.id !== testUserRecordId
    ).length;
  } catch {
    /* non-fatal */
  }

  // 1. createWinnerVideo → winner_video_submitted (to winner_videos:manage holders)
  const wvA = await createWinnerVideo({
    reference_model_name: `${RUN_TAG} ref model`,
    content_type: "Skit",
    video_link: "https://example.invalid/test-winner-video",
    note: `${RUN_TAG} winner video submission`,
    submitted_by_id: testUserRecordId,
    submitted_by_name: "TEST_VERIFY_NOTIF VA",
  });
  createdWinnerVideoIds.add(wvA.id);
  await verify({
    event: "winner_video_submitted",
    method: "service",
    entityId: wvA.id,
    expectedUserId: null,
    expectedRecipientCount: wvManageHolders,
  });

  // 2. approveWinnerVideo → winner_video_approved (submitter=test user)
  //    + research_assigned_to_creative (assigned_creative_id=test user)
  await approveWinnerVideo(wvA.id, {
    assigned_creator_name: "TEST_VERIFY_NOTIF model",
    // Airtable `recreation_deadline` is a date-only column — send YYYY-MM-DD, not a full ISO datetime.
    recreation_deadline: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
    assigned_creative_id: testUserRecordId,
    assigned_creative_name: "TEST_VERIFY_NOTIF creative",
    reviewed_by_name: "TEST_VERIFY_NOTIF reviewer",
  });
  await verify({
    event: "winner_video_approved",
    method: "service",
    entityId: wvA.id,
    expectedUserId: testUserRecordId,
  });
  await verify({
    event: "research_assigned_to_creative",
    method: "service",
    entityId: wvA.id,
    expectedUserId: testUserRecordId,
  });

  // 3. submitCreativeScript → creative_script_submitted (to creative_scripts:manage holders)
  await submitCreativeScript(wvA.id, {
    assigned_creator_name: "TEST_VERIFY_NOTIF model",
    script_video_type: "UGC",
    script_text: `${RUN_TAG} script text v1`,
    script_submitted_by_name: "TEST_VERIFY_NOTIF creative",
    script_submitted_by_id: testUserRecordId,
  });
  await verify({
    event: "creative_script_submitted",
    method: "service",
    entityId: wvA.id,
    expectedUserId: null,
    expectedRecipientCount: scriptManageHolders,
  });

  // 4. rejectCreativeScript → creative_script_rejected (submitter=test user)
  await rejectCreativeScript(wvA.id, {
    script_text: `${RUN_TAG} script text v1`,
    reviewed_by_name: "TEST_VERIFY_NOTIF reviewer",
    script_rejection_reason: "Verification rejection reason.",
  });
  await verify({
    event: "creative_script_rejected",
    method: "service",
    entityId: wvA.id,
    expectedUserId: testUserRecordId,
  });

  // 5. resubmitCreativeScript → creative_script_resubmitted (to holders)
  await resubmitCreativeScript(wvA.id, {
    assigned_creator_name: "TEST_VERIFY_NOTIF model",
    script_video_type: "UGC",
    script_text: `${RUN_TAG} script text v2`,
    script_submitted_by_name: "TEST_VERIFY_NOTIF creative",
    script_submitted_by_id: testUserRecordId,
  });
  await verify({
    event: "creative_script_resubmitted",
    method: "service",
    entityId: wvA.id,
    expectedUserId: null,
    expectedRecipientCount: scriptManageHolders,
  });

  // 6. approveCreativeScript → creative_script_approved (submitter=test user)
  await approveCreativeScript(wvA.id, {
    script_text: `${RUN_TAG} script text v2`,
    reviewed_by_name: "TEST_VERIFY_NOTIF reviewer",
  });
  await verify({
    event: "creative_script_approved",
    method: "service",
    entityId: wvA.id,
    expectedUserId: testUserRecordId,
  });

  // 7. Fresh winner video → rejectWinnerVideo → winner_video_rejected (submitter=test user)
  const wvB = await createWinnerVideo({
    reference_model_name: `${RUN_TAG} ref model B`,
    content_type: "UGC",
    video_link: "https://example.invalid/test-winner-video-b",
    note: `${RUN_TAG} winner video submission B`,
    submitted_by_id: testUserRecordId,
    submitted_by_name: "TEST_VERIFY_NOTIF VA",
  });
  createdWinnerVideoIds.add(wvB.id);
  // (creation fires winner_video_submitted again to holders — captured for cleanup, not asserted)
  await findNotificationsByEntityId(wvB.id);

  await rejectWinnerVideo(wvB.id, {
    rejection_reason: "Verification rejection reason.",
    reviewed_by_name: "TEST_VERIFY_NOTIF reviewer",
  });
  await verify({
    event: "winner_video_rejected",
    method: "service",
    entityId: wvB.id,
    expectedUserId: testUserRecordId,
  });
}

async function runSpotCheckFlow(): Promise<void> {
  let holders = 0;
  try {
    holders = (await listUsersWithPermission(PERMISSIONS.SPOTCHECK_MANAGE)).filter(
      (u) => u.id && u.id !== testUserRecordId
    ).length;
  } catch {
    /* non-fatal */
  }

  // createSpotCheck → spot_check_logged (to spotcheck:manage holders).
  // manager_id = test user so the status-change notification lands on the test user.
  const sc = await createSpotCheck({
    subject: `${RUN_TAG} spot check`,
    type: "Exec QA",
    manager_name: "TEST_VERIFY_NOTIF manager",
    manager_id: testUserRecordId,
    exec_va_name: "TEST_VERIFY_NOTIF exec VA",
    what_was_wrong: "Verification note.",
    action_taken: "Verification action.",
    status: "Pending",
  });
  createdSpotCheckIds.add(sc.id);
  await verify({
    event: "spot_check_logged",
    method: "service",
    entityId: sc.id,
    expectedUserId: null,
    expectedRecipientCount: holders,
  });

  // updateSpotCheck status → Fixed fires spot_check_status_changed to before.manager_id (test user)
  await updateSpotCheck(sc.id, { status: "Fixed" });
  await verify({
    event: "spot_check_status_changed",
    method: "service",
    entityId: sc.id,
    expectedUserId: testUserRecordId,
  });
}

// ----------------------------------------------------------------------------
// Setup / cleanup
// ----------------------------------------------------------------------------
async function createTestUser(): Promise<string> {
  const rec = await createRecord<Record<string, unknown>>(USERS_TABLE, {
    user_id: `${RUN_TAG}_user`,
    full_name: `${RUN_TAG}_USER`,
    email: `test-verify-notif.${Date.now()}@example.invalid`,
    role: "chatter",
    status: "inactive",
    can_login: false,
    notes: "Temporary recipient for scripts/verify-all-notifications.ts — safe to delete.",
  });
  return rec.id;
}

async function sweepAndCleanup(): Promise<void> {
  console.log("\n🧹 Cleanup — removing test records…");

  // 1. Delete captured notification records.
  let notifDeleted = 0;
  for (const id of createdNotificationRecordIds) {
    try {
      await deleteRecord(NOTIFICATIONS_TABLE, id);
      notifDeleted++;
    } catch {
      /* ignore */
    }
  }

  // 2. Idempotent sweep: any leftover notifications whose entity_id carries the sweep tag
  //    (covers prior crashed runs). Only deletes records we could have created.
  try {
    const leftovers = await listAllRecords<Record<string, unknown>>(NOTIFICATIONS_TABLE, {
      filterByFormula: `FIND("${SWEEP_TAG}", {${NOTIFICATION_FIELDS.entity_id}} & "")`,
    });
    for (const r of leftovers) {
      try {
        await deleteRecord(NOTIFICATIONS_TABLE, r.id);
        notifDeleted++;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  // 3. Delete flagship source records (captured + swept by RUN_TAG / prior TEST_VERIFY_NOTIF tag).
  let wvDeleted = 0;
  for (const id of createdWinnerVideoIds) {
    try {
      await deleteRecord(WINNER_VIDEOS_TABLE, id);
      wvDeleted++;
    } catch {
      /* ignore */
    }
  }
  try {
    const wvLeftovers = await listAllRecords<Record<string, unknown>>(WINNER_VIDEOS_TABLE, {
      filterByFormula: `FIND("${SWEEP_TAG}", {reference_model_name} & "")`,
    });
    for (const r of wvLeftovers) {
      try {
        await deleteRecord(WINNER_VIDEOS_TABLE, r.id);
        wvDeleted++;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  let scDeleted = 0;
  for (const id of createdSpotCheckIds) {
    try {
      await deleteSpotCheck(id);
      scDeleted++;
    } catch {
      /* ignore */
    }
  }
  try {
    const scLeftovers = await listAllRecords<Record<string, unknown>>(SPOT_CHECKS_TABLE, {
      filterByFormula: `FIND("${SWEEP_TAG}", {subject} & "")`,
    });
    for (const r of scLeftovers) {
      try {
        await deleteRecord(SPOT_CHECKS_TABLE, r.id);
        scDeleted++;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  // 4. Delete throwaway user(s).
  let userDeleted = 0;
  try {
    const users = await listAllRecords<Record<string, unknown>>(USERS_TABLE, {
      filterByFormula: `FIND("${SWEEP_TAG}", {full_name} & "")`,
    });
    for (const r of users) {
      try {
        await deleteRecord(USERS_TABLE, r.id);
        userDeleted++;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  console.log(
    `   deleted → notifications: ${notifDeleted}, winner_videos: ${wvDeleted}, spot_checks: ${scDeleted}, users: ${userDeleted}`
  );
}

// ----------------------------------------------------------------------------
// Report
// ----------------------------------------------------------------------------
function printReport(): void {
  results.sort((a, b) => a.event.localeCompare(b.event));

  const pass = results.filter((r) => r.status === "PASS");
  const fail = results.filter((r) => r.status === "FAIL");
  const notTestable = results.filter((r) => r.status === "NOT-DIRECTLY-TESTABLE");

  const icon = (s: Status) => (s === "PASS" ? "✅" : s === "FAIL" ? "❌" : "⚠️ ");

  console.log("\n" + "=".repeat(96));
  console.log("NOTIFICATION VERIFICATION REPORT");
  console.log("=".repeat(96));
  for (const r of results) {
    console.log(
      `${icon(r.status)} ${r.event.padEnd(38)} [${r.method.padEnd(7)}] → ${r.airtableEventType.padEnd(30)} ${r.detail}`
    );
  }

  console.log("\n" + "-".repeat(96));
  console.log(
    `TOTALS: ${results.length} checked | ✅ ${pass.length} pass | ❌ ${fail.length} fail | ⚠️  ${notTestable.length} not-directly-testable`
  );

  if (fail.length > 0) {
    console.log("\n❌ FAILURES / BROKEN EVENTS:");
    for (const r of fail) console.log(`   - ${r.event} (expected "${r.airtableEventType}"): ${r.detail}`);
  }
  if (notTestable.length > 0) {
    console.log("\n⚠️  NOT DIRECTLY TESTABLE (cron/time-based — verify via code review):");
    for (const r of notTestable) console.log(`   - ${r.event} → ${r.airtableEventType}`);
  }
  console.log("=".repeat(96));
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  if (!process.env.AIRTABLE_TOKEN || !process.env.AIRTABLE_BASE_ID) {
    console.error("❌ AIRTABLE_TOKEN and AIRTABLE_BASE_ID must be set (.env / .env.local).");
    process.exit(1);
  }

  console.log(`▶ verify-all-notifications — run tag: ${RUN_TAG}`);

  try {
    testUserRecordId = await createTestUser();
    console.log(`✓ Test recipient user created: ${testUserRecordId} (no preferences row → un-gated)`);

    // 1. Flagship real-service flows (proves service → notify wiring).
    console.log("\n▶ Flagship service flows (winner videos, creative scripts, spot checks)…");
    try {
      await runWinnerVideoAndCreativeScriptFlow();
    } catch (err) {
      console.error("   winner-video/creative-script flow error:", err);
      results.push({
        event: "winner_video_flow",
        airtableEventType: "-",
        method: "service",
        status: "FAIL",
        detail: `flow threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    try {
      await runSpotCheckFlow();
    } catch (err) {
      console.error("   spot-check flow error:", err);
      results.push({
        event: "spot_check_flow",
        airtableEventType: "-",
        method: "service",
        status: "FAIL",
        detail: `flow threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // 2. Notify-path + cron events (base source event types).
    console.log("\n▶ Notify-path checks (route/action-fired + cron events)…");
    for (const entry of NOTIFY_EVENTS) {
      await checkNotify({
        event: entry.event,
        entityType: entry.entityType,
        method: entry.cron ? "cron" : "notify",
        markCron: entry.cron,
      });
    }

    // 3. Admin monitoring variants (auto-fired by notifyByRoleConfig in production).
    console.log("\n▶ Admin monitoring variant mapping checks…");
    for (const base of NOTIFICATION_EVENTS_WITH_ADMIN_VARIANT) {
      await checkNotify({
        event: `${base}_admin` as NotificationEventType,
        entityType: "system",
        method: "notify",
      });
    }
  } finally {
    await sweepAndCleanup();
  }

  printReport();

  const failCount = results.filter((r) => r.status === "FAIL").length;
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
