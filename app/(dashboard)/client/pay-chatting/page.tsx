import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import { ROUTES } from "@/lib/routes";
import { PaymentForm } from "@/components/client-portal/payment-form";
import { RefreshButton } from "@/components/client-portal/refresh-button";
import {
  getAllClientBillingModels,
  getClientCurrentChattingCycleFromRevenues,
  getClientPaymentMethods,
  getLatestSubmissionForCycle,
} from "@/services/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientPayChattingPage({
  searchParams,
}: {
  searchParams?: Promise<{ cycle?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  const params = searchParams ? await searchParams : {};
  const cycleIdHint = typeof params?.cycle === "string" ? params.cycle : undefined;
  const clientId = getClientAirtableId(user);

  const result = await getClientCurrentChattingCycleFromRevenues(clientId, cycleIdHint);
  const cycle = result?.cycle ?? null;
  const cycleRevenues = result?.payableRevenues ?? [];

  const [methods, allModels] = await Promise.all([
    getClientPaymentMethods(clientId),
    getAllClientBillingModels(),
  ]);

  const latestSubmission = cycle?.id
    ? await getLatestSubmissionForCycle(cycle.id, clientId)
    : null;

  const modelIdToName = Object.fromEntries(allModels.map((m) => [m.id, m.model_name]));
  const now = new Date();
  const serverDateStrings = {
    today: now.toISOString().slice(0, 10),
    min: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10),
    max: now.toISOString().slice(0, 10),
  };

  return (
    <div className="pb-20 md:pb-0">
      <div className="mb-8 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold text-white">Pay Chatting Expenses</h1>
          <p className="text-gray-400">Submit payment proof for weekly chatting expenses</p>
        </div>
        <RefreshButton />
      </div>
      <PaymentForm
        billingCycle={cycle}
        paymentMethods={methods}
        kind="chatting_weekly"
        latestSubmission={latestSubmission}
        serverDateStrings={serverDateStrings}
        cycleRevenues={cycleRevenues}
        modelIdToName={modelIdToName}
      />
    </div>
  );
}
