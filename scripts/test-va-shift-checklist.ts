/**
 * Regression: VA task shift must gate checklist completion consistently.
 * Run: npx tsx scripts/test-va-shift-checklist.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { getUserByAirtableId } from "@/services/users";
import { getActiveVaTaskShift, resolveShiftChatterRecordId } from "@/services/shifts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  const shifts = await getActiveVaTaskShift("rec2jxoaBOR4Y5Jbb");
  assert(!!shifts, "rec id lookup should find Giannis active shift");

  const user = await getUserByAirtableId("rec2jxoaBOR4Y5Jbb");
  assert(!!user?.user_id, "user has user_id");
  const byUserId = await getActiveVaTaskShift(user!.user_id);
  assert(!!byUserId, "user_id lookup should resolve to same active shift");

  const resolved = await resolveShiftChatterRecordId(user!.user_id);
  assert(resolved === "rec2jxoaBOR4Y5Jbb", "resolveShiftChatterRecordId maps user_id → rec id");

  const noShift = await getActiveVaTaskShift("recAYMv1bPzK7JrzD");
  assert(noShift === null, "VA without shift returns null");

  console.log("✅ VA shift checklist regression checks passed");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
