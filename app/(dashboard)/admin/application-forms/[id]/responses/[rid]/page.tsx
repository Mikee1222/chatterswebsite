import { notFound } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getApplicationFormById,
  getResponseDetail,
} from "@/services/application-forms";
import { ensureResponseEnrichment } from "@/services/application-response-enrichment";
import { AdminApplicationResponseDetailClient } from "@/components/admin-application-response-detail-client";

type Props = { params: Promise<{ id: string; rid: string }> };

export default async function AdminApplicationResponseDetailPage({ params }: Props) {
  const session = await requireAdminRoute(
    await getSessionFromCookies(),
    PERMISSIONS.APPLICATIONS_VIEW,
  );
  const { id, rid } = await params;
  const [form, canManage] = await Promise.all([
    getApplicationFormById(id),
    hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE),
  ]);
  if (!form) notFound();

  // Lazy AI summary + flags on first admin view (cached thereafter)
  const response =
    (await ensureResponseEnrichment(rid, { generateAi: true })) ??
    (await getResponseDetail(rid));
  if (!response || response.form_id !== form.id) notFound();

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
