#!/usr/bin/env npx tsx
/**
 * Run with: npx tsx scripts/fix-notification-setup.ts
 *
 * For every user missing a notification_preferences row, creates defaults via
 * createDefaultPreferencesForUser (same as in-app onboarding).
 */
import "dotenv/config";
import { listAllUsers } from "../services/users";
import { getPreferencesByUserId, createDefaultPreferencesForUser } from "../services/notification-preferences";

async function fixMissingPreferences() {
  console.log("Fetching all users…");
  const users = await listAllUsers();

  let created = 0;
  for (const user of users) {
    if (!user.id) continue;
    const existing = await getPreferencesByUserId(user.id);
    if (existing) continue;
    const label = (user.full_name || user.email || user.id).trim();
    console.log(`Creating preferences for: ${label}`);
    await createDefaultPreferencesForUser(user.id);
    created += 1;
  }

  console.log(`\n✅ Done. Created ${created} missing preference row(s).`);
}

fixMissingPreferences().catch((e) => {
  console.error(e);
  process.exit(1);
});
