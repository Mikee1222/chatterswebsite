import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getFinesBonusesForUser } from "@/services/fines-bonuses";
import { listAllModelss } from "@/services/modelss";
import { FinesBonusesClient } from "@/components/fines-bonuses-client";

export default async function FinesBonusesPage() {
  const session = await getSessionFromCookies();
  const role = getEffectiveStaffRole(session);
  if (!session || (role !== "chatter" && role !== "virtual_assistant")) {
    redirect(ROUTES.dashboard);
  }

  const userId = (session.airtableUserId ?? session.id)?.trim();
  if (!userId) redirect(ROUTES.dashboard);

  const [initialEntries, modelss] = await Promise.all([
    getFinesBonusesForUser(userId).catch(() => []),
    listAllModelss('{status} = "active"').catch(() => []),
  ]);

  const isChatter = role === "chatter";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <FinesBonusesClient
        initialEntries={initialEntries}
        modelss={modelss.map((m) => ({
          id: m.id,
          model_name: m.model_name,
          paypal_email: m.paypal_email,
          paypal_link: m.paypal_link,
          revolut_tag: m.revolut_tag,
          payment_notes: m.payment_notes,
          payment_threshold_eur: m.payment_threshold_eur,
        }))}
        showPaymentMethods={isChatter}
        showExtraRevenueForm={isChatter}
      />
    </div>
  );
}
