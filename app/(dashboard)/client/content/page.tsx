import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import { ROUTES } from "@/lib/routes";
import { ClientContentHub } from "@/components/client-portal/client-content-hub";
import { getClientModels } from "@/services/client-portal";
import { listApprovedCustomRequestsByModel } from "@/services/custom-requests";
import { getModelById } from "@/services/modelss";
import { listVAContentAssignmentsForModel } from "@/services/va-content-assignments";
import { getUserByAirtableId } from "@/services/users";
import type { CustomRequest, ModelContentAssignmentCardDTO } from "@/types";

export const dynamic = "force-dynamic";

export type ClientContentModelData = {
  modelRecordId: string;
  modelName: string;
  stableModelId: string;
  assignments: ModelContentAssignmentCardDTO[];
  customRequests: CustomRequest[];
};

export default async function ClientContentPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  const clientId = getClientAirtableId(user);
  const clientModels = await getClientModels(clientId);

  const models: ClientContentModelData[] = [];

  for (const assignment of clientModels) {
    const modelRecordId = assignment.model[0]?.trim();
    if (!modelRecordId) continue;

    const modelRecord = await getModelById(modelRecordId).catch(() => null);
    const stableModelId = modelRecord?.model_id?.trim() ?? "";
    const modelName =
      assignment.model_name?.trim() || modelRecord?.model_name?.trim() || "Unnamed model";

    const [assignmentRows, customRequests] = await Promise.all([
      listVAContentAssignmentsForModel(modelRecordId, stableModelId).catch(() => []),
      listApprovedCustomRequestsByModel(modelRecordId).catch(() => []),
    ]);

    const vaIds = [...new Set(assignmentRows.map((r) => r.va_id).filter(Boolean))] as string[];
    const vaNames = new Map<string, string>();
    await Promise.all(
      vaIds.map(async (id) => {
        const vaUser = await getUserByAirtableId(id).catch(() => null);
        if (vaUser?.full_name?.trim()) vaNames.set(id, vaUser.full_name.trim());
        else if (vaUser?.email) vaNames.set(id, vaUser.email);
      }),
    );

    const assignments: ModelContentAssignmentCardDTO[] = assignmentRows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      deadline: r.deadline,
      scheduled_date: r.scheduled_date,
      completed_at: r.completed_at,
      file_url: r.file_url,
      file_attachment: r.file_attachment.map((a) => ({ url: a.url, filename: a.filename })),
      priority: r.priority,
      status: r.status,
      va_name: r.va_id ? (vaNames.get(r.va_id) ?? null) : null,
      content_type: r.content_type,
    }));

    models.push({
      modelRecordId,
      modelName,
      stableModelId,
      assignments,
      customRequests,
    });
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-violet-300/60">Content</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">Content Hub</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Manage VA content assignments and custom requests across your models.
        </p>
      </div>
      <ClientContentHub clientId={clientId} models={models} />
    </div>
  );
}
