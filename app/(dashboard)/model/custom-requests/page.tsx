import { getModelContext } from "@/lib/model-context-server";
import { listApprovedCustomRequestsByModel } from "@/services/custom-requests";
import { ModelCustomRequestsClient } from "@/components/model-custom-requests-client";
import { ModelRouteEmptyState } from "@/components/model-route-feedback";
import { Suspense } from "react";

export default async function ModelCustomRequestsPage() {
  const { user, linkedModelId, modelRecord, language } = await getModelContext();

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Custom requests</h1>
        <p className="text-white/70">Please log in.</p>
      </div>
    );
  }

  if (!linkedModelId || !modelRecord) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Custom requests</h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Your account is not linked to a model profile. Contact an admin to link your account.
        </p>
      </div>
    );
  }

  let requests: Awaited<ReturnType<typeof listApprovedCustomRequestsByModel>> = [];
  try {
    requests = await listApprovedCustomRequestsByModel(linkedModelId);
  } catch (error) {
    throw error instanceof Error ? error : new Error("Failed to load custom requests.");
  }

  return (
    <div className="space-y-8 pb-8 md:space-y-10 md:pb-10">
      <header className="max-md:pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          {language === "es" ? "Contenido" : "Content"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          {language === "es" ? "Encargos personalizados" : "Custom requests"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55 md:text-[15px]">
          {language === "es"
            ? "Revisa encargos aceptados por la agencia, programa fechas y marca cuando hayas subido el contenido."
            : "Review agency-approved requests, set your shoot schedule, and mark when you have uploaded the content."}
        </p>
      </header>

      {requests.length === 0 ? (
        <ModelRouteEmptyState
          title={language === "es" ? "No hay encargos activos" : "No active custom requests"}
          description={
            language === "es"
              ? "Cuando la agencia apruebe nuevos encargos, apareceran aqui para programarlos y marcarlos como subidos."
              : "When the agency approves new requests, they will appear here so you can schedule and mark uploads."
          }
        />
      ) : null}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />}>
        <ModelCustomRequestsClient requests={requests} language={language} />
      </Suspense>
    </div>
  );
}
