import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import { ROUTES } from "@/lib/routes";
import { ClientWeeklyPaymentsCalendar } from "@/components/client-portal/weekly-payments-calendar";
import { getCalendarEvents } from "@/services/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientWeeklyPaymentsPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  const clientId = getClientAirtableId(user);
  const events = await getCalendarEvents(clientId).catch(() => []);

  return (
    <div className="pb-20 md:pb-0">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white">Weekly Payments Program</h1>
        <p className="text-gray-400">View your payment schedule</p>
      </div>
      <ClientWeeklyPaymentsCalendar events={events} />
    </div>
  );
}
