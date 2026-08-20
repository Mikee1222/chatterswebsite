import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listApplicationForms } from "@/services/application-forms";
import { AdminApplicationFormsClient } from "@/components/admin-application-forms-client";

export default async function AdminApplicationFormsPage() {
  const session = await requireAdminRoute(
    await getSessionFromCookies(),
    PERMISSIONS.APPLICATIONS_VIEW,
  );
  const [forms, canManage] = await Promise.all([
    listApplicationForms().catch(() => []),
    hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE),
  ]);

  return <AdminApplicationFormsClient initialForms={forms} canManage={canManage} />;
}
