import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import { isSupabaseBackend } from "@/lib/data-backend";
import { ROUTES } from "@/lib/routes";
import { sbResolveUuidToAirtableMap } from "@/lib/supabase-data";
import { ClientContentHub } from "@/components/client-portal/client-content-hub";
import { getClientModels } from "@/services/client-portal";
import { listApprovedCustomRequestsByModels } from "@/services/custom-requests";
import { getUsersByAirtableIds } from "@/services/users";
import { listVAContentAssignmentsForModels } from "@/services/va-content-assignments";
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
  const modelRecordIds = [
    ...new Set(clientModels.map((assignment) => assignment.model[0]?.trim()).filter(Boolean) as string[]),
  ];

  const [assignmentRows, customRequests, modelAt] = await Promise.all([
    listVAContentAssignmentsForModels(modelRecordIds).catch(() => []),
    listApprovedCustomRequestsByModels(modelRecordIds).catch(() => []),
    isSupabaseBackend()
      ? sbResolveUuidToAirtableMap(
          "modelss",
          clientModels.map((assignment) => assignment.model)
        ).catch(() => new Map<string, string>())
      : Promise.resolve(new Map<string, string>()),
  ]);

  const vaIds = [...new Set(assignmentRows.map((r) => r.va_id).filter(Boolean))] as string[];
  const vaUsers = await getUsersByAirtableIds(vaIds).catch(() => new Map());
  const vaNames = new Map<string, string>();
  for (const [id, vaUser] of vaUsers) {
    const label = vaUser.full_name?.trim() || vaUser.email || "";
    if (label) vaNames.set(id, label);
  }

  const assignmentsByModel = new Map<string, ModelContentAssignmentCardDTO[]>();
  for (const r of assignmentRows) {
    const dto: ModelContentAssignmentCardDTO = {
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
    };
    const keys = [r.model_id].filter(Boolean);
    for (const key of keys) {
      const list = assignmentsByModel.get(key) ?? [];
      list.push(dto);
      assignmentsByModel.set(key, list);
    }
  }

  const customsByModel = new Map<string, CustomRequest[]>();
  for (const req of customRequests) {
    const keys = [req.assigned_model_id, req.model_id].filter(Boolean) as string[];
    for (const key of keys) {
      const list = customsByModel.get(key) ?? [];
      if (!list.some((existing) => existing.id === req.id)) list.push(req);
      customsByModel.set(key, list);
    }
  }

  const models: ClientContentModelData[] = [];
  const seenModels = new Set<string>();

  for (const assignment of clientModels) {
    const modelRecordId = assignment.model[0]?.trim();
    if (!modelRecordId || seenModels.has(modelRecordId)) continue;
    seenModels.add(modelRecordId);

    const lookupKeys = [modelRecordId, modelAt.get(modelRecordId)].filter(Boolean) as string[];
    const assignments = dedupeById(lookupKeys.flatMap((key) => assignmentsByModel.get(key) ?? []));
    const modelCustoms = dedupeById(lookupKeys.flatMap((key) => customsByModel.get(key) ?? []));

    models.push({
      modelRecordId,
      modelName: assignment.model_name?.trim() || "Unnamed model",
      stableModelId: "",
      assignments,
      customRequests: modelCustoms,
    });
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Content</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">Content Hub</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Manage Chatting Assignments and custom requests across your models.
        </p>
      </div>
      <ClientContentHub clientId={clientId} models={models} />
    </div>
  );
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}
