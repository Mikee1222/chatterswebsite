import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  emitIntegrationHealthAlerts,
  getIntegrationHealthSnapshot,
} from "@/services/integration-health";
import { IntegrationHealthClient } from "@/components/integration-health-client";
import { AiUsageVisibilityWidget } from "@/components/ai-usage-visibility-widget";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AdminIntegrationsPage() {
  const session = await requireAdminRoute(
    await getSessionFromCookies(),
    PERMISSIONS.INTEGRATIONS_VIEW,
  );
  const snapshot = await getIntegrationHealthSnapshot();
  // Fire-and-forget proactive alerts for red status
  void emitIntegrationHealthAlerts(snapshot);

  const canManage = await hasPermission(session, PERMISSIONS.INTEGRATIONS_MANAGE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Integrations</h1>
        <p className="mt-1 text-sm text-white/55">
          Health of Infloww, ClarioSuite, Anthropic, and Supabase — last sync, status, and
          actionable alerts. Approximate AI call volume is listed below.
        </p>
      </div>
      <IntegrationHealthClient initial={snapshot} canManage={canManage} />
      <AiUsageVisibilityWidget />
    </div>
  );
}
