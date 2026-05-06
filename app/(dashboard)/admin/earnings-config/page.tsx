import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getInflowwModels } from "@/lib/infloww-api";
import { listEarningsAgencyCutConfig } from "@/services/earnings-config";
import { AdminEarningsConfigClient } from "@/components/admin-earnings-config-client";

export default async function AdminEarningsConfigPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const [models, percents] = await Promise.all([
    getInflowwModels().catch(() => []),
    listEarningsAgencyCutConfig().catch(() => ({})),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Earnings config</h1>
        <p className="mt-1 text-sm text-white/55">
          Set agency cut % per model (stored in Airtable <code className="text-[hsl(330,80%,70%)]">earnings_config</code>
          ). Create that table with fields <code className="text-white/70">model_id</code> (text) and{" "}
          <code className="text-white/70">agency_cut_percent</code> (number) if it does not exist yet.
        </p>
      </div>
      <AdminEarningsConfigClient models={models} initialPercents={percents} />
    </div>
  );
}
