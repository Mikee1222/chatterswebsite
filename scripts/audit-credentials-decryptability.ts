/**
 * Audit decryptability of credential_entries and hire passwords with current key.
 *   set -a && source .env && set +a && npx tsx scripts/audit-credentials-decryptability.ts
 */

import "./_polyfill-websocket";
import { decryptCredentialPayload } from "../lib/credentials-crypto";
import { getSupabaseServiceClient } from "../lib/supabase-server";

async function main() {
  if (!process.env.CREDENTIALS_ENCRYPTION_KEY?.trim()) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be set");
  }

  const sb = getSupabaseServiceClient();

  const { data: entries, error: entriesErr } = await sb
    .from("credential_entries")
    .select("id, label, encrypted_data");
  if (entriesErr) throw new Error(entriesErr.message);

  let decryptable = 0;
  let undecryptable = 0;
  const undecryptableIds: string[] = [];

  for (const row of entries ?? []) {
    try {
      decryptCredentialPayload(String(row.encrypted_data ?? ""));
      decryptable++;
    } catch {
      undecryptable++;
      undecryptableIds.push(String(row.id));
    }
  }

  console.log("credential_entries total:", entries?.length ?? 0);
  console.log("credential_entries decryptable:", decryptable);
  console.log("credential_entries undecryptable:", undecryptable);

  const { data: hires, error: hiresErr } = await sb
    .from("application_form_responses")
    .select("id, status, generated_username, encrypted_hire_password")
    .not("encrypted_hire_password", "is", null);
  if (hiresErr) throw new Error(hiresErr.message);

  const withPassword = (hires ?? []).filter(
    (r) => String(r.encrypted_hire_password ?? "").trim() !== "",
  );

  let hireDecryptable = 0;
  let hireUndecryptable = 0;
  const hireUndecryptableRows: Array<{
    id: string;
    status: string;
    generated_username: string | null;
  }> = [];

  for (const row of withPassword) {
    try {
      const payload = decryptCredentialPayload(String(row.encrypted_hire_password ?? ""));
      if (!payload.password?.trim()) throw new Error("missing password");
      hireDecryptable++;
    } catch {
      hireUndecryptable++;
      hireUndecryptableRows.push({
        id: String(row.id),
        status: String(row.status ?? ""),
        generated_username: row.generated_username as string | null,
      });
    }
  }

  console.log("hire encrypted passwords total:", withPassword.length);
  console.log("hire decryptable:", hireDecryptable);
  console.log("hire undecryptable:", hireUndecryptable);
  if (hireUndecryptableRows.length) {
    console.log("hire undecryptable rows:", JSON.stringify(hireUndecryptableRows, null, 2));
  }
  if (undecryptableIds.length && undecryptableIds.length <= 5) {
    console.log("undecryptable entry ids:", undecryptableIds.join(", "));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
