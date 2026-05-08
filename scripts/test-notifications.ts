#!/usr/bin/env npx tsx
/**
 * Fire every preset in `NOTIFICATION_TEST_PRESETS` via real `notify()` + Airtable.
 *
 *   npx tsx scripts/test-notifications.ts
 *
 * Requires `.env` / `.env.local` with Airtable credentials (same as other scripts).
 * Picks the first **active** user per role (chatter, virtual_assistant, model, admin).
 * Skips a row if no matching user exists.
 */
import "dotenv/config";

import {
  NOTIFICATION_TEST_PRESETS,
  buildDebugTestEntityId,
  type NotificationTestGroup,
} from "@/lib/notification-test-presets";
import { notify } from "@/services/notification-service";
import { listAllUsers } from "@/services/users";
import type { UserRecord } from "@/types";

function pickUserForGroup(users: UserRecord[], group: NotificationTestGroup): UserRecord | null {
  const active = users.filter((u) => (u.status ?? "").toLowerCase() === "active" && u.id?.trim());
  const roleMatch = (u: UserRecord) => {
    if (group === "virtual_assistant") return u.role === "virtual_assistant";
    return u.role === group;
  };
  return active.find(roleMatch) ?? null;
}

async function main() {
  const users = await listAllUsers();
  const byGroup = {
    chatter: pickUserForGroup(users, "chatter"),
    virtual_assistant: pickUserForGroup(users, "virtual_assistant"),
    model: pickUserForGroup(users, "model"),
    admin: pickUserForGroup(users, "admin"),
  } as const;

  console.log("[test-notifications] Recipients:");
  for (const g of ["chatter", "virtual_assistant", "model", "admin"] as const) {
    const u = byGroup[g];
    console.log(`  ${g}: ${u ? `${u.id} (${u.full_name || u.email})` : "— none —"}`);
  }

  let passed = 0;
  let skipped = 0;
  let failed = 0;

  for (const preset of NOTIFICATION_TEST_PRESETS) {
    const recipient = byGroup[preset.group];
    if (!recipient?.id) {
      console.warn(`⊘ SKIP: ${preset.id} (no active user for role ${preset.group})`);
      skipped++;
      continue;
    }
    try {
      await notify({
        user_id: recipient.id,
        event_type: preset.event_type,
        title: preset.title,
        body: preset.body,
        entity_type: preset.entity_type,
        entity_id: buildDebugTestEntityId(preset.id),
        _triggerSource: "scripts/test-notifications",
      });
      console.log(`✅ ${preset.id} → ${recipient.id}`);
      passed++;
    } catch (e) {
      console.error(`❌ ${preset.id}`, e);
      failed++;
    }
  }

  console.log(`\n=== Done: ${passed} sent, ${skipped} skipped, ${failed} failed ===`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
