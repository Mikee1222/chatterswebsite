import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getFinesBonusesForUser } from "@/services/fines-bonuses";
import { FinesBonusesClient } from "@/components/fines-bonuses-client";

export default async function FinesBonusesPage() {
  const session = await getSessionFromCookies();
  const role = getEffectiveStaffRole(session);
  if (!session || (role !== "chatter" && role !== "virtual_assistant")) {
    redirect(ROUTES.dashboard);
  }

  const userId = (session.airtableUserId ?? session.id)?.trim();
  if (!userId) redirect(ROUTES.dashboard);

  const initialEntries = await getFinesBonusesForUser(userId).catch(() => []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <FinesBonusesClient initialEntries={initialEntries} />
    </div>
  );
}
