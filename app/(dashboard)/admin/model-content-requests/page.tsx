import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listAllModelContentRequests } from "@/services/model-content-requests";
import { listAllModelss } from "@/services/modelss";
import { AdminModelContentRequestsClient } from "@/components/admin-model-content-requests-client";

export default async function AdminModelContentRequestsPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.CONTENT_VIEW);

  const [rows, models] = await Promise.all([
    listAllModelContentRequests().catch(() => []),
    listAllModelss().catch(() => []),
  ]);
  const modelNameById: Record<string, string> = {};
  for (const m of models) modelNameById[m.id] = m.model_name || m.model_id || m.id;

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminModelContentRequestsClient initialRows={rows} modelNameById={modelNameById} />
    </div>
  );
}
