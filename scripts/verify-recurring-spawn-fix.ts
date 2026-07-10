#!/usr/bin/env npx tsx
/**
 * Verify recurring spawn rules after fix:
 * - spawnToday does not create future rows
 * - spawnNext after complete does not create tomorrow when today is completed
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { addDaysAthensYmd } from "@/lib/airtable-datetime";
import { filterTasksByAthensYmd, getVaTasksViewTodayYmd } from "@/lib/va-task-date-filter";
import { ymdInAthens } from "@/lib/airtable-datetime";
import {
  spawnNextRecurringOccurrenceAfterComplete,
  spawnTodayRecurringOccurrencesAll,
  spawnTodayRecurringOccurrencesForVa,
} from "@/services/va-task-recurring-spawn";
import { getAllVaTasks, getVaTasksForUser } from "@/services/va-tasks";

const VA_ID = "rec2jxoaBOR4Y5Jbb";

async function countRealOnDay(tasks: Awaited<ReturnType<typeof getAllVaTasks>>, ymd: string) {
  return tasks.filter(
    (t) => t.is_recurring && !t.is_virtual_occurrence && t.due_date && ymdInAthens(t.due_date) === ymd,
  ).length;
}

async function main() {
  const today = getVaTasksViewTodayYmd();
  const tomorrow = addDaysAthensYmd(today, 1);

  console.log("=== Pre-spawn state ===");
  let all = await getAllVaTasks();
  console.log(`Real recurring today (${today}):`, await countRealOnDay(all, today));
  console.log(`Real recurring tomorrow (${tomorrow}):`, await countRealOnDay(all, tomorrow));

  console.log("\n=== spawnTodayRecurringOccurrencesForVa ===");
  const vaResult = await spawnTodayRecurringOccurrencesForVa(VA_ID);
  console.log("Result:", vaResult);

  all = await getAllVaTasks();
  const vaToday = filterTasksByAthensYmd(await getVaTasksForUser(VA_ID), today).filter((t) =>
    t.title.includes("Daily Marketing"),
  );
  const vaTomorrow = filterTasksByAthensYmd(await getVaTasksForUser(VA_ID), tomorrow).filter((t) =>
    t.title.includes("Daily Marketing"),
  );
  console.log(`VA DMR today: ${vaToday.length} (${vaToday.filter((t) => !t.is_virtual_occurrence).length} real)`);
  console.log(
    `VA DMR tomorrow: ${vaTomorrow.length} (${vaTomorrow.filter((t) => !t.is_virtual_occurrence).length} real, ${vaTomorrow.filter((t) => t.is_virtual_occurrence).length} virtual)`,
  );

  console.log("\n=== spawnTodayRecurringOccurrencesAll (idempotent) ===");
  const allResult = await spawnTodayRecurringOccurrencesAll();
  console.log("Result:", allResult);
  all = await getAllVaTasks();
  console.log(`Real recurring today after all-spawn:`, await countRealOnDay(all, today));
  console.log(`Real recurring tomorrow after all-spawn:`, await countRealOnDay(all, tomorrow));

  console.log("\n=== spawnNextRecurringOccurrenceAfterComplete (simulated today complete) ===");
  let spawnNextResult: Awaited<ReturnType<typeof spawnNextRecurringOccurrenceAfterComplete>> = null;
  const todayRow = all.find(
    (t) =>
      t.title.includes("Daily Marketing") &&
      t.assigned_to_ids.includes(VA_ID) &&
      t.due_date &&
      ymdInAthens(t.due_date) === today,
  );
  if (todayRow) {
    const fakeCompleted = { ...todayRow, status: "done" as const };
    spawnNextResult = await spawnNextRecurringOccurrenceAfterComplete(fakeCompleted, all);
    console.log("spawnNext result:", spawnNextResult ? spawnNextResult.id : "null (expected — tomorrow stays virtual)");
    all = await getAllVaTasks();
    console.log(`Real recurring tomorrow after spawnNext:`, await countRealOnDay(all, tomorrow));
  } else {
    console.log("No today row found for spawnNext test");
  }

  console.log("\n=== PASS criteria ===");
  const realToday = await countRealOnDay(all, today);
  const realTomorrow = await countRealOnDay(all, tomorrow);
  const dmrTodayReal = all.filter(
    (t) =>
      t.title.includes("Daily Marketing") &&
      t.assigned_to_ids.includes(VA_ID) &&
      !t.is_virtual_occurrence &&
      t.due_date &&
      ymdInAthens(t.due_date) === today &&
      (t.status === "pending" || t.status === "in_progress"),
  );
  console.log(`✓ 1 real DMR today for VA: ${dmrTodayReal.length === 1 ? "PASS" : "FAIL (" + dmrTodayReal.length + ")"}`);
  console.log(`✓ 0 real rows tomorrow: ${realTomorrow === 0 ? "PASS" : "FAIL (" + realTomorrow + ")"}`);
  console.log(`✓ spawnNext did not create tomorrow: ${spawnNextResult === null ? "PASS" : "FAIL"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
