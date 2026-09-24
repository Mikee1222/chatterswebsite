import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import { ROUTES } from "@/lib/routes";
import { ClientMonthlyAiReportCard } from "@/components/client-monthly-ai-report-card";
import { ClientGunzoPartnershipView } from "@/components/client-portal/gunzo-partnership-client-view";
import { getClientPartnershipInflowwStats } from "@/services/client-partnership-infloww";
import { getClientById } from "@/services/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientGunzoPartnershipPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  const clientId = getClientAirtableId(user);

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      <div>
        <h1 className="text-3xl font-bold text-white">Gunzo Partnership</h1>
        <p className="text-gray-400">How your account is performing.</p>
      </div>
      <ClientMonthlyAiReportCard />
      <Suspense
        fallback={
          <div className="glass-card rounded-2xl p-8 text-gray-400">Loading partnership stats…</div>
        }
      >
        <ClientGunzoPartnershipStats clientId={clientId} />
      </Suspense>
    </div>
  );
}

async function ClientGunzoPartnershipStats({ clientId }: { clientId: string }) {
  const [client, inflowwStats] = await Promise.all([
    getClientById(clientId).catch(() => null),
    getClientPartnershipInflowwStats(clientId, "this_month"),
  ]);

  return (
    <ClientGunzoPartnershipView
      inflowwStats={inflowwStats}
      clientName={client?.display_name || client?.company_name}
    />
  );
}
