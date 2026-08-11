import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import { ROUTES } from "@/lib/routes";
import { ClientGunzoPartnershipView } from "@/components/client-portal/gunzo-partnership-client-view";
import { getClientPartnershipInflowwStats } from "@/services/client-partnership-infloww";
import { getClientById, getClientPartnershipAnalytics } from "@/services/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientGunzoPartnershipPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  const clientId = getClientAirtableId(user);
  const client = await getClientById(clientId).catch(() => null);
  const params = await searchParams;
  const now = new Date();
  const currentMonthUtc = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const requestedMonth =
    params.month || (currentMonthUtc.startsWith("2026") ? currentMonthUtc : "2026-01");

  const [data, inflowwStats] = await Promise.all([
    getClientPartnershipAnalytics(clientId, requestedMonth),
    getClientPartnershipInflowwStats(clientId, "this_month"),
  ]);

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      <div>
        <h1 className="text-3xl font-bold text-white">Gunzo Partnership</h1>
        <p className="text-gray-400">
          How your account is performing — plus partnership billing and fees.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="glass-card rounded-2xl p-8 text-gray-400">Loading…</div>
        }
      >
        <ClientGunzoPartnershipView
          data={data}
          inflowwStats={inflowwStats}
          selectedMonth={requestedMonth}
          availableMonths2026={data.availableMonths2026}
          clientName={client?.display_name || client?.company_name}
        />
      </Suspense>
    </div>
  );
}
