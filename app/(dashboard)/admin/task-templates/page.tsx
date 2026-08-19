import { Suspense } from "react";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getAllTaskTemplatesAdmin } from "@/services/task-templates";
import { getTimerConfigs } from "@/services/task-category-timer";
import { AdminTasksSettingsClient } from "@/components/admin-tasks-settings-client";

type SearchParams = Promise<{ tab?: string }>;

export default async function AdminTaskTemplatesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.TASK_TEMPLATES_MANAGE);

  const { tab } = await searchParams;
  const initialTab = tab === "timer-config" ? "timer-config" : "templates";

  const [templates, timerConfigs] = await Promise.all([
    getAllTaskTemplatesAdmin().catch(() => []),
    getTimerConfigs().catch(() => []),
  ]);

  return (
    <Suspense>
      <AdminTasksSettingsClient
        initialTemplates={templates}
        initialTimerConfigs={timerConfigs}
        initialTab={initialTab}
      />
    </Suspense>
  );
}
