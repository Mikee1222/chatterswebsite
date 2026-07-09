/**
 * Fresh audit: create brand-new daily recurring task, trace virtual projection for tomorrow.
 * Run: AUDIT_TRACE_SERIES_TITLE=AUDIT-VIRT npx tsx scripts/audit-virtual-preview-fresh.ts
 * Cleanup: pass --cleanup to delete the created task after audit.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { addDaysAthensYmd, ymdInAthens } from "@/lib/airtable-datetime";
import {
  expandTasksForAthensYmd,
  filterTasksByAthensYmd,
  getVaTasksViewTodayYmd,
} from "@/lib/va-task-date-filter";
import {
  occurrenceDueForAthensYmd,
  shouldSpawnRecurring,
  vaTaskSeriesKey,
} from "@/lib/recurrence";
import { buildGetAllVaTasksFormula } from "@/lib/va-tasks-airtable-formula";
import {
  VA_TASKS_ADMIN_FETCH_FUTURE_DAYS,
  VA_TASKS_ADMIN_FETCH_PAST_DAYS,
} from "@/lib/va-tasks-airtable-formula";
import { createVaTask, deleteVaTask, getAllVaTasks, getVaTasksForUser } from "@/services/va-tasks";
import { listAllRecords } from "@/lib/airtable-server";
import { linkedRecordIds } from "@/lib/airtable-linked";

const AUDIT_PREFIX = process.env.AUDIT_TRACE_SERIES_TITLE?.trim() || "AUDIT-VIRT";
const cleanup = process.argv.includes("--cleanup");

type UserFields = { role?: string; status?: string; full_name?: string; user_id?: string };

async function pickTestVa(): Promise<{ recId: string; name: string }> {
  const users = await listAllRecords<UserFields>("users", {});
  const va = users.find(
    (u) =>
      u.fields.role === "virtual_assistant" &&
      (u.fields.status ?? "").toLowerCase() === "active" &&
      u.fields.user_id?.trim(),
  );
  if (!va) throw new Error("No active VA with user_id found");
  return { recId: va.id, name: va.fields.full_name ?? va.id };
}

function logSection(title: string) {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

async function main() {
  process.env.AUDIT_TRACE_SERIES_TITLE = AUDIT_PREFIX;

  const today = getVaTasksViewTodayYmd();
  const tomorrow = addDaysAthensYmd(today, 1);
  logSection(`STEP 1 — Fresh test case (today=${today}, tomorrow=${tomorrow})`);

  const va = await pickTestVa();
  console.log("Test VA:", va.name, va.recId);

  const auditTitle = `${AUDIT_PREFIX}-${Date.now()}`;
  const dueIso = new Date().toISOString();
  console.log("Creating task:", auditTitle, "due:", dueIso);

  const created = await createVaTask({
    title: auditTitle,
    description: "Audit-only fresh daily recurring — safe to delete",
    assigned_to_ids: [va.recId],
    status: "pending",
    priority: "normal",
    due_date: dueIso,
    is_recurring: true,
    recurrence_type: "daily",
    recurrence_interval: 1,
    recurrence_end_date: null,
  });

  console.log("Created Airtable row:", created.id);
  console.log("Mapped fields:", {
    is_recurring: created.is_recurring,
    recurrence_type: JSON.stringify(created.recurrence_type),
    recurrence_type_len: created.recurrence_type?.length,
    due_date: created.due_date,
    due_ymd_athens: ymdInAthens(created.due_date),
  });

  const seriesKey = vaTaskSeriesKey(created);
  console.log("Series key:", JSON.stringify(seriesKey));

  logSection("STEP 2 — VA path (getVaTasksForUser → filterTasksByAthensYmd)");

  const vaTasks = await getVaTasksForUser(va.recId);
  const vaHasRow = vaTasks.some((t) => t.id === created.id);
  console.log("VA fetch includes created row:", vaHasRow, `(total ${vaTasks.length} tasks)`);

  const vaToday = filterTasksByAthensYmd(vaTasks, today);
  const vaTomorrow = filterTasksByAthensYmd(vaTasks, tomorrow);
  console.log("VA today count:", vaToday.filter((t) => t.title === auditTitle).length, "matching audit title");
  console.log("VA tomorrow count:", vaTomorrow.filter((t) => t.title === auditTitle).length, "matching audit title");

  console.log("\n--- VA tomorrow expand with AUDIT logging ---");
  expandTasksForAthensYmd(vaTasks, tomorrow);

  logSection("STEP 2b — Admin path (getAllVaTasks scoped → filterTasksByAthensYmd)");

  const adminFormula = buildGetAllVaTasksFormula({
    athensStartYmd: addDaysAthensYmd(today, -VA_TASKS_ADMIN_FETCH_PAST_DAYS),
    athensEndYmd: addDaysAthensYmd(today, VA_TASKS_ADMIN_FETCH_FUTURE_DAYS),
  });
  console.log("Admin formula (truncated):", adminFormula?.slice(0, 200) + "...");

  const adminTasks = await getAllVaTasks({
    athensStartYmd: addDaysAthensYmd(today, -VA_TASKS_ADMIN_FETCH_PAST_DAYS),
    athensEndYmd: addDaysAthensYmd(today, VA_TASKS_ADMIN_FETCH_FUTURE_DAYS),
  });
  const adminHasRow = adminTasks.some((t) => t.id === created.id);
  console.log("Admin fetch includes created row:", adminHasRow, `(total ${adminTasks.length} tasks)`);

  const adminToday = filterTasksByAthensYmd(adminTasks, today);
  const adminTomorrow = filterTasksByAthensYmd(adminTasks, tomorrow);
  console.log("Admin today audit matches:", adminToday.filter((t) => t.title === auditTitle).length);
  console.log("Admin tomorrow audit matches:", adminTomorrow.filter((t) => t.title === auditTitle).length);

  console.log("\n--- Admin tomorrow expand with AUDIT logging ---");
  expandTasksForAthensYmd(adminTasks, tomorrow);

  logSection("STEP 3 — Direct recurrence trace (no UI)");

  console.log("shouldSpawnRecurring(created):", shouldSpawnRecurring(created));
  console.log("occurrenceDueForAthensYmd today:", occurrenceDueForAthensYmd(created, today));
  console.log("occurrenceDueForAthensYmd tomorrow:", occurrenceDueForAthensYmd(created, tomorrow));

  logSection("STEP 4 — Raw Airtable field check");

  const raw = await listAllRecords<{
    title?: string;
    is_recurring?: boolean;
    recurrence_type?: string;
    due_date?: string;
    assigned_to?: string[];
  }>("va_tasks", {
    filterByFormula: `{title} = "${auditTitle.replace(/"/g, '\\"')}"`,
  });
  if (raw[0]) {
    console.log("Raw Airtable fields:", JSON.stringify(raw[0].fields, null, 2));
    console.log("assigned_to record ids:", linkedRecordIds(raw[0].fields.assigned_to));
  }

  logSection("SUMMARY");
  const vaOkToday = vaToday.some((t) => t.title === auditTitle);
  const vaOkTomorrow = vaTomorrow.some((t) => t.title === auditTitle);
  const adminOkToday = adminToday.some((t) => t.title === auditTitle);
  const adminOkTomorrow = adminTomorrow.some((t) => t.title === auditTitle);

  console.log({
    vaOkToday,
    vaOkTomorrow,
    adminOkToday,
    adminOkTomorrow,
    sameRootCauseLikely: vaOkTomorrow === adminOkTomorrow,
    createdId: created.id,
    auditTitle,
  });

  if (cleanup) {
    await deleteVaTask(created.id);
    console.log("Cleaned up audit task", created.id);
  } else {
    console.log("\nTask left in Airtable for manual UI check. Re-run with --cleanup to delete.");
    console.log("Title:", auditTitle);
    console.log("ID:", created.id);
  }
}

main().catch((e) => {
  console.error("AUDIT FAILED:", e);
  process.exit(1);
});
