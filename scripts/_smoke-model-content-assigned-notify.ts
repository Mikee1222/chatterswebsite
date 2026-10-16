/**
 * Smoke: model gets model_content_assigned when chatting content is delivered.
 * Run: npx tsx scripts/_smoke-model-content-assigned-notify.ts
 */
import "./_polyfill-websocket";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.vercel.local" });
loadEnv({ path: ".env.local" });
loadEnv();
process.env.DATA_BACKEND = process.env.DATA_BACKEND || "supabase";


async function main() {
  const { createVaContentAssignmentAdmin } = await import("../services/va-content-assignments");
  const { notifyModelOfContentAssignment } = await import(
    "../services/va-content-assignment-model-notify"
  );
  const { notify } = await import("../services/notification-service");
  const { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } = await import("../lib/notification-types");
  const { getPreferencesByUserId, updateNotificationPreference } = await import(
    "../services/notification-preferences"
  );

  const MODEL = "recm7xLOotXa1vQHc"; // Lydia
  const VA = "recgGxdpOFMUCQJdA"; // Evi
  const MODEL_USER = "recSix6TG9k1vDo4Q";

  const adminRow = await createVaContentAssignmentAdmin({
    va_user_record_id: VA,
    model_record_id: MODEL,
    title: `[notif-test] admin assign ${Date.now()}`,
    description: "Smoke test admin path model notify",
    content_type: "Other",
    priority: "normal",
    deadline: null,
    direct_assign: true,
  });
  const adminNotify = await notifyModelOfContentAssignment({
    modelRecordId: MODEL,
    assignmentId: adminRow.id,
    title: adminRow.title,
    actorName: "Admin smoke",
    triggerSource: "smoke_admin_create_model",
  });
  console.log("ADMIN", JSON.stringify({ assignmentId: adminRow.id, ...adminNotify }));

  const vaRow = await createVaContentAssignmentAdmin({
    va_user_record_id: VA,
    model_record_id: MODEL,
    title: `[notif-test] va assign ${Date.now()}`,
    description: "Smoke test VA path model notify",
    content_type: "Other",
    priority: "normal",
    deadline: null,
  });
  const vaNotify = await notifyModelOfContentAssignment({
    modelRecordId: MODEL,
    assignmentId: vaRow.id,
    title: vaRow.title,
    actorUserId: VA,
    actorName: "VA smoke",
    triggerSource: "smoke_va_create_model",
  });
  console.log("VA", JSON.stringify({ assignmentId: vaRow.id, ...vaNotify }));

  const prefs = await getPreferencesByUserId(MODEL_USER);
  if (!prefs?.id) throw new Error("no prefs for Lydia");
  const prev = prefs.task_alerts;
  await updateNotificationPreference(prefs.id, { task_alerts: false });
  const blocked = await notify({
    user_id: MODEL_USER,
    event_type: NOTIFICATION_EVENT.MODEL_CONTENT_ASSIGNED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "[notif-test] should be blocked",
    body: "task_alerts off",
    entity_type: "va_content_assignment",
    entity_id: "prefs-gate-test",
    _triggerSource: "smoke_prefs_off",
  });
  await updateNotificationPreference(prefs.id, { task_alerts: prev ?? true });
  console.log(
    "PREFS_OFF",
    JSON.stringify({
      notification: blocked.notification ? "CREATED_BUG" : null,
      pushSent: blocked.pushSent,
    })
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
