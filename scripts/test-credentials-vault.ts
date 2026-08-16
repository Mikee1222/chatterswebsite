/**
 * Password Library smoke test — run with env loaded:
 *   set -a && source .env && set +a && npx tsx scripts/test-credentials-vault.ts
 */

import "./_polyfill-websocket";
import {
  createCredentialEntry,
  copyCredentialField,
  revealCredentialField,
  listCredentialAccessLog,
  deleteCredentialEntry,
} from "../services/credential-entries";
import { getSupabaseServiceClient } from "../lib/supabase-server";
import { toCustomFieldRef } from "../lib/credentials-types";

async function main() {
  if (!process.env.CREDENTIALS_ENCRYPTION_KEY?.trim()) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be set in .env");
  }

  const actor = { userId: "test-script", userName: "Test Script" };

  console.log("Creating TEST password library entry…");
  const entry = await createCredentialEntry(
    {
      model_id: null,
      category: "Custom QA Category",
      label: "TEST Password Library Entry",
      data: {
        username: "test_user_library",
        password: "SuperSecretTestPassword123!",
        email: "test@library.example.com",
        notes: "Automated test entry — safe to delete",
        customFields: {
          api_key: "test-api-key-xyz",
          pin_code: "4242",
          security_answer: "fluffy",
        },
      },
    },
    actor,
  );
  console.log("Created entry:", entry.id);
  console.log("Custom field keys:", entry.custom_field_keys.join(", "));
  console.log(
    "Custom fields encrypted:",
    entry.has_custom_fields && entry.custom_field_keys.length === 3 ? "PASS" : "FAIL",
  );

  const sb = getSupabaseServiceClient();
  const { data: row } = await sb
    .from("credential_entries")
    .select("encrypted_data,label")
    .eq("id", entry.id)
    .single();

  const ciphertext = row?.encrypted_data ?? "";
  const hasPlaintext =
    ciphertext.includes("SuperSecretTestPassword123!") ||
    ciphertext.includes("test_user_library") ||
    ciphertext.includes("test-api-key-xyz");

  console.log("DB ciphertext sample:", ciphertext.slice(0, 48) + "…");
  console.log("Plaintext in DB:", hasPlaintext ? "FAIL — found plaintext" : "PASS — ciphertext only");

  const revealed = await revealCredentialField(entry.id, "password", actor);
  console.log("Reveal password:", revealed.value === "SuperSecretTestPassword123!" ? "PASS" : "FAIL");

  const customRevealed = await revealCredentialField(entry.id, toCustomFieldRef("api_key"), actor);
  console.log("Reveal custom api_key:", customRevealed.value === "test-api-key-xyz" ? "PASS" : "FAIL");

  const copied = await copyCredentialField(entry.id, "username", actor);
  console.log("Copy username:", copied.value === "test_user_library" ? "PASS" : "FAIL");

  const logs = await listCredentialAccessLog({ credentialId: entry.id });
  const actions = logs.map((l) => l.action);
  console.log("Audit actions:", actions.join(", "));
  console.log(
    "Audit logging:",
    actions.includes("created") && actions.includes("revealed") && actions.includes("copied")
      ? "PASS"
      : "FAIL",
  );

  await deleteCredentialEntry(entry.id, actor);
  console.log("Cleaned up test entry.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
