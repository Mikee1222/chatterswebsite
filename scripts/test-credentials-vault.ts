/**
 * Credentials vault smoke test — run with env loaded:
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

async function main() {
  if (!process.env.CREDENTIALS_ENCRYPTION_KEY?.trim()) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be set in .env");
  }

  const actor = { userId: "test-script", userName: "Test Script" };

  console.log("Creating TEST credential entry…");
  const entry = await createCredentialEntry(
    {
      model_id: null,
      category: "General",
      label: "TEST Vault Entry",
      data: {
        username: "test_user_vault",
        password: "SuperSecretTestPassword123!",
        email: "test@vault.example.com",
        notes: "Automated test entry — safe to delete",
      },
    },
    actor,
  );
  console.log("Created entry:", entry.id);

  const sb = getSupabaseServiceClient();
  const { data: row } = await sb
    .from("credential_entries")
    .select("encrypted_data,label")
    .eq("id", entry.id)
    .single();

  const ciphertext = row?.encrypted_data ?? "";
  const hasPlaintext =
    ciphertext.includes("SuperSecretTestPassword123!") ||
    ciphertext.includes("test_user_vault") ||
    ciphertext.includes("test@vault.example.com");

  console.log("DB ciphertext sample:", ciphertext.slice(0, 48) + "…");
  console.log("Plaintext in DB:", hasPlaintext ? "FAIL — found plaintext" : "PASS — ciphertext only");

  const revealed = await revealCredentialField(entry.id, "password", actor);
  console.log("Reveal password:", revealed.value === "SuperSecretTestPassword123!" ? "PASS" : "FAIL");

  const copied = await copyCredentialField(entry.id, "username", actor);
  console.log("Copy username:", copied.value === "test_user_vault" ? "PASS" : "FAIL");

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
