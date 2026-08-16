import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getCachedModelss } from "@/lib/modelss-cache";
import { CredentialsVaultClient } from "@/components/credentials-vault-client";

export default async function AdminCredentialsVaultPage() {
  const session = await requireAdminRoute(
    await getSessionFromCookies(),
    PERMISSIONS.CREDENTIALS_VIEW,
  );

  const [models, canManage] = await Promise.all([
    getCachedModelss().catch(() => []),
    hasPermission(session, PERMISSIONS.CREDENTIALS_MANAGE),
  ]);

  const modelById = Object.fromEntries(
    models.map((m) => [m.id, (m.model_name ?? "").trim() || "Model"]),
  );

  return (
    <CredentialsVaultClient
      modelById={modelById}
      models={models}
      canManage={canManage}
    />
  );
}
