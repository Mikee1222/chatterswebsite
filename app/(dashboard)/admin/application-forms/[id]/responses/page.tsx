import { notFound } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getApplicationFormById } from "@/services/application-forms";
import { AdminApplicationResponsesClient } from "@/components/admin-application-responses-client";

type Props = { params: Promise<{ id: string }> };

export default async function AdminApplicationResponsesPage({ params }: Props) {
  const session = await requireAdminRoute(
    await getSessionFromCookies(),
    PERMISSIONS.APPLICATIONS_VIEW,
  );
  const { id } = await params;
  const [form, canManage] = await Promise.all([
    getApplicationFormById(id),
    hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE),
  ]);
  if (!form) notFound();

  return <AdminApplicationResponsesClient form={form} canManage={canManage} />;
}
