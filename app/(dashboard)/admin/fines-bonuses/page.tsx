import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listFinesBonuses } from "@/services/fines-bonuses";
import { listAllUsers } from "@/services/users";
import { AdminFinesBonusesClient } from "@/components/admin-fines-bonuses-client";

export default async function AdminFinesBonusesPage() {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    redirect(ROUTES.dashboard);
  }

  const [entries, users] = await Promise.all([
    listFinesBonuses({}).catch(() => []),
    listAllUsers().catch(() => []),
  ]);

  const userOptions = users
    .filter((u) => u.role === "chatter" || u.role === "virtual_assistant")
    .map((u) => ({
      id: u.id,
      name: (u.full_name ?? "").trim() || u.email || u.id,
      user_role: u.role === "virtual_assistant" ? ("va" as const) : ("chatter" as const),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <AdminFinesBonusesClient initialEntries={entries} userOptions={userOptions} />
    </div>
  );
}
