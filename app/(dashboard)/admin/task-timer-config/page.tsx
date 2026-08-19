import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getTimerConfigs } from "@/services/task-category-timer";
import { AdminTaskTimerConfigClient } from "@/components/admin-task-timer-config-client";

export default async function AdminTaskTimerConfigPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.TASK_TEMPLATES_MANAGE);

  const configs = await getTimerConfigs().catch(() => []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      <AdminTaskTimerConfigClient initialConfigs={configs} />
    </div>
  );
}
