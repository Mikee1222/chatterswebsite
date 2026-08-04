/**
 * Audit ALL recurring tasks for tomorrow projection failures.
 * Run: AUDIT_TRACE_SERIES_TITLE= npx tsx scripts/audit-existing-recurring-tasks.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { addDaysAthensYmd } from "@/lib/airtable-datetime";
import { filterTasksByAthensYmd, getVaTasksViewTodayYmd } from "@/lib/va-task-date-filter";
import { occurrenceDueForAthensYmd, shouldSpawnRecurring, vaTaskSeriesKey } from "@/lib/recurrence";
import { getAllVaTasks, getVaTasksForUser } from "@/services/va-tasks";
import { linkedRecordIds } from "@/lib/airtable-linked";
import { listAllRecords } from "@/lib/airtable-server";
import type { VaTaskRecord } from "@/types";

async function main() {
  const today = getVaTasksViewTodayYmd();
  const tomorrow = addDaysAthensYmd(today, 1);

  const allRecurring = await listAllRecords<{
    title?: string;
    is_recurring?: boolean;
    recurrence_type?: string;
    due_date?: string;
    recurrence_end_date?: string;
    status?: string;
    assigned_to?: string[];
  }>("va_tasks", {
    filterByFormula: "{is_recurring} = TRUE()",
    sort: [{ field: "due_date", direction: "desc" }],
  });

  console.log(`Found ${allRecurring.length} recurring rows in Airtable`);
  console.log(`Today=${today} Tomorrow=${tomorrow}\n`);

  const failures: Array<{
    id: string;
    title: string;
    issue: string;
    recurrence_type: string;
    due_date: string | undefined;
  }> = [];

  for (const rec of allRecurring) {
    const f = rec.fields;
    const title = f.title ?? rec.id;
    const mapped = {
      id: rec.id,
      title,
      description: "",
      assigned_to_ids: linkedRecordIds(f.assigned_to),
      assigned_by_ids: [],
      assigned_model_ids: [],
      assigned_model_names: [],
      status: (f.status as VaTaskRecord["status"]) ?? "pending",
      priority: "normal" as const,
      due_date: f.due_date?.trim() ?? null,
      is_recurring: Boolean(f.is_recurring),
      recurrence_type: (f.recurrence_type?.trim() ?? "") as VaTaskRecord["recurrence_type"],
      recurrence_days: [],
      recurrence_interval: 1,
      recurrence_end_date: f.recurrence_end_date?.trim() ?? null,
      recurrence_skipped_dates: [],
      reminder_minutes_before: null,
      completed_at: null,
      completed_notes: "",
      overdue_notified_at: null,
      created_at: null,
    } satisfies VaTaskRecord;

    const issues: string[] = [];
    if (!mapped.recurrence_type) issues.push("empty recurrence_type after map");
    if (!shouldSpawnRecurring(mapped)) issues.push("shouldSpawnRecurring=false");
    const nextDue = occurrenceDueForAthensYmd(mapped, tomorrow);
    if (!nextDue) issues.push("occurrenceDueForAthensYmd(tomorrow)=null");

    if (issues.length) {
      failures.push({
        id: rec.id,
        title,
        issue: issues.join("; "),
        recurrence_type: JSON.stringify(f.recurrence_type),
        due_date: f.due_date,
      });
    }
  }

  console.log(`=== Per-row failures for tomorrow (${failures.length}) ===`);
  for (const x of failures) {
    console.log(`- [${x.id}] ${x.title}`);
    console.log(`  recurrence_type=${x.recurrence_type} due=${x.due_date}`);
    console.log(`  issue: ${x.issue}`);
  }

  // End-to-end via getAllVaTasks (admin path)
  const adminTasks = await getAllVaTasks({
    athensStartYmd: addDaysAthensYmd(today, -365),
    athensEndYmd: addDaysAthensYmd(today, 365),
  });
  const adminTomorrow = filterTasksByAthensYmd(adminTasks, tomorrow);
  const adminRecurringTomorrow = adminTomorrow.filter((t) => t.is_recurring);

  console.log(`\n=== Admin path tomorrow ===`);
  console.log(`Total tasks tomorrow: ${adminTomorrow.length}`);
  console.log(`Recurring (real+virtual) tomorrow: ${adminRecurringTomorrow.length}`);

  // Compare series that have ANY recurring row vs projected tomorrow
  const seriesWithAnchor = new Set<string>();
  for (const t of adminTasks) {
    if (t.is_recurring && !t.is_virtual_occurrence && shouldSpawnRecurring(t)) {
      seriesWithAnchor.add(vaTaskSeriesKey(t));
    }
  }
  const seriesTomorrow = new Set(adminRecurringTomorrow.map((t) => vaTaskSeriesKey(t)));
  const missingSeries = [...seriesWithAnchor].filter((k) => !seriesTomorrow.has(k));
  console.log(`\nActive series count: ${seriesWithAnchor.size}`);
  console.log(`Series with tomorrow instance: ${seriesTomorrow.size}`);
  console.log(`Missing tomorrow projection (${missingSeries.length}):`);
  for (const key of missingSeries.slice(0, 20)) {
    const [title] = key.split("\0");
    const rows = adminTasks.filter((t) => vaTaskSeriesKey(t) === key && t.is_recurring);
    console.log(`  - ${title} (${rows.length} rows)`);
    for (const r of rows.slice(0, 3)) {
      console.log(`      id=${r.id} due=${r.due_date} type=${JSON.stringify(r.recurrence_type)} spawn=${shouldSpawnRecurring(r)}`);
    }
  }

  // VA path sample
  const users = await listAllRecords<{ role?: string; status?: string; full_name?: string }>("users", {});
  const va = users.find((u) => u.fields.role === "virtual_assistant" && u.fields.status === "active");
  if (va) {
    const vaTasks = await getVaTasksForUser(va.id);
    const vaTomorrow = filterTasksByAthensYmd(vaTasks, tomorrow);
    console.log(`\n=== VA path (${va.fields.full_name}) tomorrow: ${vaTomorrow.length} tasks ===`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
