import { getModelContext } from "@/lib/model-context-server";
import { listCustomRequestsByModel } from "@/services/custom-requests";
import { listModelTasks } from "@/services/model-tasks";
import { listVAContentAssignmentsForModel } from "@/services/va-content-assignments";
import { ModelContentCalendarClient } from "@/components/model-content-calendar-client";
import { ModelRouteEmptyState } from "@/components/model-route-feedback";
import { Suspense } from "react";

/**
 * Airtable `custom_requests.admin_status` uses **accepted** (not "approved") for admin-approved rows.
 * This page only includes customs with `admin_status === "accepted"`.
 */
export default async function ModelContentCalendarPage() {
  const { user, linkedModelId, modelRecord } = await getModelContext();

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Content calendar</h1>
        <p className="text-white/70">Please log in to continue.</p>
      </div>
    );
  }

  if (!linkedModelId || !modelRecord) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Content calendar</h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Your account is not linked to a model profile. Contact an admin to link your account.
        </p>
      </div>
    );
  }

  let assignments: Awaited<ReturnType<typeof listVAContentAssignmentsForModel>> = [];
  let allCustoms: Awaited<ReturnType<typeof listCustomRequestsByModel>> = [];
  let tasks: Awaited<ReturnType<typeof listModelTasks>> = [];
  try {
    [assignments, allCustoms, tasks] = await Promise.all([
      listVAContentAssignmentsForModel(linkedModelId),
      listCustomRequestsByModel(linkedModelId),
      listModelTasks(linkedModelId),
    ]);
  } catch (error) {
    throw error instanceof Error ? error : new Error("Failed to load content calendar.");
  }

  const customs = allCustoms.filter((c) => c.admin_status === "accepted");

  const modelName = modelRecord.model_name?.trim() || undefined;

  return (
    <div className="space-y-6">
      {assignments.length === 0 && customs.length === 0 && tasks.length === 0 ? (
        <ModelRouteEmptyState
          title="No content planned yet"
          description="No VA assignments, accepted customs, or tasks are currently scheduled. New work will appear here automatically."
        />
      ) : null}
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-white/[0.04]" />}>
        <ModelContentCalendarClient assignments={assignments} customs={customs} tasks={tasks} modelName={modelName} />
      </Suspense>
    </div>
  );
}
