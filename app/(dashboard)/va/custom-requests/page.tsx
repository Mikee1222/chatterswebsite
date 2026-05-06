import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listAdminPendingCustomRequests, listAllCustomRequests } from "@/services/custom-requests";
import { listVAContentAssignmentsForVaUser } from "@/services/va-content-assignments";
import { listAllModelss } from "@/services/modelss";
import { VaCustomRequestsClient } from "@/components/va-custom-requests-client";
import type { CustomRequest } from "@/types";

/**
 * VA customs queue — all `custom_requests` rows (same as admin list scope per spec).
 * Airtable `admin_status`: **pending** | **accepted** | **rejected** (not approved/declined).
 */
export default async function VaCustomRequestsPage() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "virtual_assistant") {
    redirect(ROUTES.dashboard);
  }

  const vaId = (session.airtableUserId ?? session.id)?.trim();
  if (!vaId) redirect(ROUTES.dashboard);

  const [requests, pendingQueue, assignments, models] = await Promise.all([
    listAllCustomRequests().catch(() => [] as CustomRequest[]),
    listAdminPendingCustomRequests().catch(() => [] as CustomRequest[]),
    listVAContentAssignmentsForVaUser(vaId).catch(() => []),
    listAllModelss().catch(() => []),
  ]);

  const pendingCount = pendingQueue.length;
  const assignedModelIds = [...new Set(assignments.map((a) => a.model_id).filter(Boolean))];
  const modelLabelById: Record<string, string> = Object.fromEntries(
    models.map((m) => [m.id, (m.model_name ?? "").trim() || "Model"])
  );

  return (
    <VaCustomRequestsClient
      initialRows={requests}
      pendingCount={pendingCount}
      assignedModelIds={assignedModelIds}
      modelLabelById={modelLabelById}
    />
  );
}
