import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import { ROUTES } from "@/lib/routes";
import { PaymentForm } from "@/components/client-portal/payment-form";
import {
  getClientCurrentBillingCycle,
  getClientPaymentMethods,
  getLatestSubmissionForCycle,
} from "@/services/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientPayCrmPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  const clientId = getClientAirtableId(user);
  const [cycle, methods] = await Promise.all([
    getClientCurrentBillingCycle(clientId, "crm_monthly"),
    getClientPaymentMethods(clientId),
  ]);

  const latestSubmission = cycle?.id
    ? await getLatestSubmissionForCycle(cycle.id, clientId)
    : null;

  const now = new Date();
  const serverDateStrings = {
    today: now.toISOString().slice(0, 10),
    min: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10),
    max: now.toISOString().slice(0, 10),
  };

  return (
    <div className="pb-20 md:pb-0">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white">Pay CRM Expenses</h1>
        <p className="text-gray-400">Submit payment proof for monthly CRM expenses</p>
      </div>
      <PaymentForm
        billingCycle={cycle}
        paymentMethods={methods}
        kind="crm_monthly"
        latestSubmission={latestSubmission}
        serverDateStrings={serverDateStrings}
      />
    </div>
  );
}
