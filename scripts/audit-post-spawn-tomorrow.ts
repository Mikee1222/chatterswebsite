/**
 * Simulate shift-start spawn then verify tomorrow virtual preview still works.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { addDaysAthensYmd } from "@/lib/airtable-datetime";
import { filterTasksByAthensYmd, getVaTasksViewTodayYmd } from "@/lib/va-task-date-filter";
import { spawnTodayRecurringOccurrencesForVa } from "@/services/va-task-recurring-spawn";
import { getVaTasksForUser, getAllVaTasks } from "@/services/va-tasks";

const TASK_ID = process.argv[2] || "recrf3l0LomaY8Jkb";
const VA_ID = process.argv[3] || "recAYMv1bPzK7JrzD";

async function main() {
  process.env.AUDIT_TRACE_SERIES_TITLE = "AUDIT-VIRT";

  const today = getVaTasksViewTodayYmd();
  const tomorrow = addDaysAthensYmd(today, 1);

  console.log("Before spawn — VA tomorrow:");
  let vaTasks = await getVaTasksForUser(VA_ID);
  let tomorrowTasks = filterTasksByAthensYmd(vaTasks, tomorrow);
  console.log("  count:", tomorrowTasks.length, tomorrowTasks.map((t) => ({ id: t.id, title: t.title, virt: t.is_virtual_occurrence })));

  console.log("\nRunning spawnTodayRecurringOccurrencesForVa...");
  const result = await spawnTodayRecurringOccurrencesForVa(VA_ID);
  console.log("Spawn result:", result);

  vaTasks = await getVaTasksForUser(VA_ID);
  const auditRows = vaTasks.filter((t) => t.id === TASK_ID || t.title.startsWith("AUDIT-VIRT"));
  console.log("\nAudit series rows after spawn:", auditRows.map((t) => ({ id: t.id, due: t.due_date, status: t.status })));

  console.log("\nAfter spawn — VA tomorrow:");
  tomorrowTasks = filterTasksByAthensYmd(vaTasks, tomorrow);
  console.log("  count:", tomorrowTasks.length, tomorrowTasks.map((t) => ({ id: t.id, title: t.title, virt: t.is_virtual_occurrence })));

  const adminTasks = await getAllVaTasks({
    athensStartYmd: addDaysAthensYmd(today, -365),
    athensEndYmd: addDaysAthensYmd(today, 365),
  });
  const adminTomorrow = filterTasksByAthensYmd(adminTasks, tomorrow).filter((t) => t.title.startsWith("AUDIT-VIRT"));
  console.log("\nAfter spawn — Admin tomorrow audit tasks:", adminTomorrow.length, adminTomorrow.map((t) => ({ id: t.id, virt: t.is_virtual_occurrence })));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
