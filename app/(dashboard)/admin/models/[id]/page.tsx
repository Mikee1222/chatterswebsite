import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getModelById } from "@/services/modelss";
import { AdminModelPeriodTrackingToggle } from "@/components/admin-model-period-tracking-toggle";
import { ModelOFSubscribers } from "@/components/model-of-subscribers";
import { SyncOFSubscribersButton } from "@/components/sync-of-subscribers-button";

export default async function AdminModelDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const id = params.id?.trim();
  if (!id) notFound();

  const model = await getModelById(id);
  if (!model) notFound();

  const isAdmin = user.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm text-white/55">
        <Link href={ROUTES.admin.models} className="hover:text-white/90">
          Models
        </Link>
        <span aria-hidden>/</span>
        <span className="text-white/80">{model.model_name || "Model"}</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{model.model_name || "Model"}</h1>
        <p className="mt-1 text-sm text-white/60">
          Model record <code className="text-white/70">{model.id}</code> · {model.platform} · {model.status}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Model settings</h2>
        {isAdmin ? (
          <div className="mt-4 max-w-md">
            <AdminModelPeriodTrackingToggle modelId={model.id} enabled={model.period_tracking_enabled === true} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/50">Period tracking toggle is visible to admins only.</p>
        )}
      </div>

      <p className="text-sm text-white/50">
        Edit account-linked fields in{" "}
        <Link href={ROUTES.modelEdit(model.id)} className="text-pink-300/90 underline-offset-2 hover:underline">
          Accounts → model
        </Link>
        .
      </p>

      {typeof model.of_user_id === "string" && model.of_user_id.trim() !== "" ? (
        <SyncOFSubscribersButton ofAccountId={model.of_user_id} modelName={model.model_name ?? ""} />
      ) : null}

      <ModelOFSubscribers
        ofUserId={String(model.of_user_id ?? "")}
        modelName={String(model.model_name ?? "")}
      />
    </div>
  );
}
