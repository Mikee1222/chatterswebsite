import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getAllTaskTemplatesAdmin } from "@/services/task-templates";
import { AdminTaskTemplatesClient } from "@/components/admin-task-templates-client";

export default async function AdminTaskTemplatesPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.TASK_TEMPLATES_MANAGE);

  const templates = await getAllTaskTemplatesAdmin().catch(() => []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <AdminTaskTemplatesClient initialTemplates={templates} />
    </div>
  );
}
