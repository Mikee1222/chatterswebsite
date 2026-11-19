import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { AdminAgentTokensClient } from "@/components/admin-agent-tokens-client";
import { listAgentTokens } from "@/services/agent-tokens";

export default async function AdminAgentTokensPage() {
  await requireAdminRoute(await getSessionFromCookies(), {
    permission: PERMISSIONS.ROLES_MANAGE,
    adminOnly: true,
  });

  const tokens = await listAgentTokens({ includeRevoked: true }).catch(() => []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Agent tokens</h1>
        <p className="mt-1 text-sm text-white/55">
          Hermes Bearer tokens (<code className="text-white/70">gz_agent_…</code>). Owner/admin only.
          Plaintext is shown once at creation — only a SHA-256 hash is stored.
        </p>
      </div>
      <AdminAgentTokensClient
        initialTokens={tokens.map((t) => ({
          id: t.id,
          token_prefix: t.token_prefix,
          label: t.label,
          created_by: t.created_by,
          created_at: t.created_at,
          expires_at: t.expires_at,
          revoked_at: t.revoked_at,
          last_used_at: t.last_used_at,
        }))}
      />
    </div>
  );
}
