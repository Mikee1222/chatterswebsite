/**
 * E2E regression: VA personal tasks must match JS filter and show today's assignees.
 * Run: npx tsx scripts/test-va-tasks-regression.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { getRecord, listAllRecords } from "@/lib/airtable-server";
import { linkedRecordIds } from "@/lib/airtable-linked";
import { ymdInAthens } from "@/lib/airtable-datetime";
import { filterTasksByAthensYmd } from "@/lib/va-task-date-filter";
import { getVaTasksForUser } from "@/services/va-tasks";

type UserFields = { role?: string; status?: string; full_name?: string; user_id?: string };

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  const today = ymdInAthens(new Date().toISOString());
  console.log("Athens today:", today);

  const users = await listAllRecords<UserFields>("users", {});
  const assigneesToday = new Set<string>();

  const allTasks = await listAllRecords<{ assigned_to?: string[]; due_date?: string }>("va_tasks", {});
  for (const t of allTasks) {
    if (ymdInAthens(t.fields.due_date) !== today) continue;
    for (const id of linkedRecordIds(t.fields.assigned_to)) assigneesToday.add(id);
  }
  console.log("Unique assignees with tasks due today:", assigneesToday.size);

  let tested = 0;
  for (const recId of assigneesToday) {
    const u = await getRecord<UserFields>("users", recId);
    const tasks = await getVaTasksForUser(recId);
    const todayTasks = filterTasksByAthensYmd(tasks, today);
    const jsExpected = allTasks
      .map((r) => ({ id: r.id, ...r.fields }))
      .filter((f) => {
        const ids = linkedRecordIds(f.assigned_to);
        return (ids.length === 0 || ids.includes(recId)) && ymdInAthens(f.due_date) === today;
      });

    console.log(`\n${u.fields.full_name} (${recId})`);
    console.log(`  service today: ${todayTasks.length} | JS expected: ${jsExpected.length}`);
    assert(todayTasks.length === jsExpected.length, `${u.fields.full_name} today count mismatch`);
    tested++;
  }

  // Multi-assignee: unassigned task visible to every active VA
  const activeVas = users.filter(
    (u) => u.fields.role === "virtual_assistant" && (u.fields.status ?? "").toLowerCase() === "active",
  );
  const unassigned = allTasks.filter((t) => linkedRecordIds(t.fields.assigned_to).length === 0);
  if (unassigned.length > 0 && activeVas.length > 0) {
    const sampleVa = activeVas[0]!;
    const tasks = await getVaTasksForUser(sampleVa.id);
    for (const t of unassigned) {
      assert(
        tasks.some((x) => x.id === t.id),
        `unassigned task ${t.id} missing for VA ${sampleVa.fields.full_name}`,
      );
    }
    console.log(`\nUnassigned tasks visible to ${sampleVa.fields.full_name}: OK (${unassigned.length})`);
  }

  // Past / future: service returns recurring anchors for date expansion
  const vaWithRecurring = activeVas[0];
  if (vaWithRecurring) {
    const tasks = await getVaTasksForUser(vaWithRecurring.id);
    const recurring = tasks.filter((t) => t.is_recurring);
    console.log(`\nRecurring rows for ${vaWithRecurring.fields.full_name}: ${recurring.length}`);
  }

  console.log(`\n✅ All checks passed (${tested} assignees with tasks today)`);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
