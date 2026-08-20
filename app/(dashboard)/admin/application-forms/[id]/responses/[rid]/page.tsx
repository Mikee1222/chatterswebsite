import { notFound } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getApplicationFormById,
  getResponseDetail,
} from "@/services/application-forms";
import { AdminApplicationResponseDetailClient } from "@/components/admin-application-response-detail-client";

type Props = { params: Promise<{ id: string; rid: string }> };

export default async function AdminApplicationResponseDetailPage({ params }: Props) {
  const session = await requireAdminRoute(
    await getSessionFromCookies(),
    PERMISSIONS.APPLICATIONS_VIEW,
  );
  const { id, rid } = await params;
  const [form, response, canManage] = await Promise.all([
    getApplicationFormById(id),
    getResponseDetail(rid),
    hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE),
  ]);
  if (!form || !response || response.form_id !== form.id) notFound();

  return (
    <AdminApplicationResponseDetailClient
      formId={form.id}
      formTitle={form.title}
      questions={form.questions}
      initialResponse={response}
      canManage={canManage}
    />
  );
}
