import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import { ROUTES } from "@/lib/routes";
import { getClientModels } from "@/services/client-portal";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientModelsPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  const models = await getClientModels(getClientAirtableId(user));

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Your Models</h1>
        <p className="mt-1 text-sm text-white/55">Models assigned to your agency account</p>
      </div>

      {models.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-white/25" />
          <p className="font-medium text-white">No models assigned yet</p>
          <p className="mt-1 text-sm text-white/50">Your model roster will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((assignment) => (
            <div
              key={assignment.id}
              className="glass-card rounded-2xl border border-white/10 p-5 transition-colors hover:border-pink-400/25"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/15 text-pink-300">
                <Users className="h-6 w-6" />
              </div>
              <p className="mt-4 text-lg font-semibold text-white">
                {assignment.model_name ?? "Unnamed model"}
              </p>
              <p className="mt-1 text-xs text-white/45">Active assignment</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
