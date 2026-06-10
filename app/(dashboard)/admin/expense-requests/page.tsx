import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listAllModelExpenseRequests } from "@/services/model-expense-requests";
import { listAllModelss } from "@/services/modelss";
import { AdminExpenseRequestsClient } from "@/components/admin-expense-requests-client";

export default async function AdminExpenseRequestsPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.PAYMENTS_MANAGE);
  const [rows, models] = await Promise.all([
    listAllModelExpenseRequests().catch(() => []),
    listAllModelss().catch(() => []),
  ]);
  const modelNameById: Record<string, string> = {};
  for (const m of models) modelNameById[m.id] = m.model_name || m.model_id || m.id;

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminExpenseRequestsClient initialRows={rows} modelNameById={modelNameById} />
    </div>
  );
}
