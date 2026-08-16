import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getCachedModelss } from "@/lib/modelss-cache";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { CredentialsVaultClient } from "@/components/credentials-vault-client";

export default async function AdminCredentialsVaultPage() {
  const session = await requireAdminRoute(
    await getSessionFromCookies(),
    PERMISSIONS.CREDENTIALS_VIEW,
  );

  const [cachedModels, canManage, idRows] = await Promise.all([
    getCachedModelss().catch(() => []),
    hasPermission(session, PERMISSIONS.CREDENTIALS_MANAGE),
    getSupabaseServiceClient()
      .from("modelss")
      .select("id, airtable_id, model_name, model_id")
      .then(({ data }) => data ?? []),
  ]);

  // credential_entries.model_id stores Supabase UUIDs; ModelRecord.id is the public Airtable id.
  const uuidByPublicId = new Map(
    idRows.flatMap((row) =>
      row.airtable_id ? ([[row.airtable_id, row.id]] as const) : [],
    ),
  );

  const modelById: Record<string, string> = {};
  for (const row of idRows) {
    const name = (row.model_name ?? "").trim();
    if (!name || !(row.model_id ?? "").trim()) continue;
    modelById[row.id] = name;
    if (row.airtable_id) modelById[row.airtable_id] = name;
  }

  const models = cachedModels.map((m) => ({
    ...m,
    id: uuidByPublicId.get(m.id) ?? m.id,
  }));

  return (
    <CredentialsVaultClient
      modelById={modelById}
      models={models}
      canManage={canManage}
    />
  );
}
