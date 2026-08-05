import { getModelContext } from "@/lib/model-context-server";
import { MobileDashboardLayout } from "@/components/mobile-dashboard-layout";
import { ModelEarningsClient } from "@/components/model-earnings-client";

export default async function ModelEarningsPage() {
  let modelRecord: Awaited<ReturnType<typeof getModelContext>>["modelRecord"] = null;
  let linkedModelId: Awaited<ReturnType<typeof getModelContext>>["linkedModelId"] = null;
  let user: Awaited<ReturnType<typeof getModelContext>>["user"] = null;
  try {
    ({ user, modelRecord, linkedModelId } = await getModelContext());
  } catch (error) {
    console.error("[model/earnings] getModelContext failed", error);
    return (
      <MobileDashboardLayout>
        <p className="text-sm text-white/60">Unable to load account context. Please try again.</p>
      </MobileDashboardLayout>
    );
  }

  if (!user) {
    return (
      <MobileDashboardLayout>
        <p className="text-sm text-white/60">Please log in to view earnings.</p>
      </MobileDashboardLayout>
    );
  }

  if (!linkedModelId || !modelRecord) {
    return (
      <MobileDashboardLayout>
        <div className="mx-auto max-w-lg space-y-3 text-center">
          <h1 className="text-xl font-semibold text-white">My earnings</h1>
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Your account is not linked to a model profile. Contact an admin to link your account.
          </p>
        </div>
      </MobileDashboardLayout>
    );
  }

  return (
    <MobileDashboardLayout>
      <ModelEarningsClient modelName={modelRecord.model_name || user.fullName || "Model"} />
    </MobileDashboardLayout>
  );
}
