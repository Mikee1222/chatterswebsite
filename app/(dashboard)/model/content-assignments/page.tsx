export const dynamic = "force-dynamic";

import { getModelContext } from "@/lib/model-context-server";
import { getModelT } from "@/lib/model-i18n";
import { listVAContentAssignmentsForModel } from "@/services/va-content-assignments";
import { getUserByAirtableId } from "@/services/users";
import { ModelContentAssignmentsClient } from "@/components/model-content-assignments-client";
import type { ModelContentAssignmentCardDTO } from "@/types";
import { ModelRouteEmptyState } from "@/components/model-route-feedback";
import { Suspense } from "react";

export default async function ModelContentAssignmentsPage() {
  let user: Awaited<ReturnType<typeof getModelContext>>["user"] = null;
  let linkedModelId: Awaited<ReturnType<typeof getModelContext>>["linkedModelId"] = null;
  let modelRecord: Awaited<ReturnType<typeof getModelContext>>["modelRecord"] = null;
  let language: Awaited<ReturnType<typeof getModelContext>>["language"] = "en";
  try {
    ({ user, linkedModelId, modelRecord, language } = await getModelContext());
  } catch (error) {
    console.error("[model/content-assignments] getModelContext failed; rendering fallback", error);
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">VA content</h1>
        <p className="text-white/70">Unable to load account context right now. Please try again.</p>
      </div>
    );
  }
  const tr = getModelT(language);

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">VA content</h1>
        <p className="text-white/70">Please log in.</p>
      </div>
    );
  }

  if (!linkedModelId || !modelRecord) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">VA content</h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Your account is not linked to a model profile. Contact an admin to link your account.
        </p>
      </div>
    );
  }

  let rows: Awaited<ReturnType<typeof listVAContentAssignmentsForModel>> = [];
  try {
    rows = await listVAContentAssignmentsForModel(linkedModelId, modelRecord.model_id);
  } catch (error) {
    console.error("[model/content-assignments] listVAContentAssignmentsForModel failed; using [] fallback", error);
  }
  const vaIds = [...new Set(rows.map((r) => r.va_id).filter(Boolean))] as string[];
  const vaNames = new Map<string, string>();
  await Promise.all(
    vaIds.map(async (id) => {
      const u = await getUserByAirtableId(id).catch((error) => {
        console.error("[model/content-assignments] getUserByAirtableId failed; using null fallback", error);
        return null;
      });
      if (u?.full_name?.trim()) vaNames.set(id, u.full_name.trim());
      else if (u?.email) vaNames.set(id, u.email);
    })
  );

  const assignments: ModelContentAssignmentCardDTO[] = rows.map((r) => ({
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
    va_name: r.va_id ? vaNames.get(r.va_id) ?? null : null,
    content_type: r.content_type,
  }));

  return (
    <div className="space-y-8 pb-8 md:space-y-10 md:pb-10">
      <header className="max-md:pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{tr("assignmentsPage.eyebrow")}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">{tr("assignmentsPage.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55 md:text-[15px]">{tr("assignmentsPage.description")}</p>
      </header>

      {assignments.length === 0 ? (
        <ModelRouteEmptyState title={tr("assignmentsPage.emptyTitle")} description={tr("assignmentsPage.emptyDescription")} />
      ) : null}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />}>
        <ModelContentAssignmentsClient assignments={assignments} />
      </Suspense>
    </div>
  );
}
