import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { AdminModelOpsPlaceholder } from "@/components/admin-model-ops-placeholder";

export default async function AdminModelTasksPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.MODELS_MANAGE);

  return (
    <AdminModelOpsPlaceholder
      title="Model tasks"
      description="Dedicated admin task views for every model are not wired yet. Use Tasks for operational tasks; model roster lives under Models."
      links={[
        { href: ROUTES.admin.vaTasks, label: "Tasks" },
        { href: ROUTES.admin.models, label: "Models" },
        { href: ROUTES.admin.home, label: "Admin home" },
      ]}
    />
  );
}
