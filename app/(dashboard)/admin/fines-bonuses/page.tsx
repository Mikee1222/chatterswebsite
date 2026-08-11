import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listFinesBonuses } from "@/services/fines-bonuses";
import { filterActiveModelsForAssignment, filterActiveUsersForAssignment } from "@/lib/assignment-filters";
import { listAllUsers } from "@/services/users";
import { getCachedModelss } from "@/lib/modelss-cache";
import { AdminFinesBonusesClient } from "@/components/admin-fines-bonuses-client";

export default async function AdminFinesBonusesPage() {
  const session = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.FINES_VIEW);

  const [entries, users, modelss] = await Promise.all([
    listFinesBonuses({}).catch(() => []),
    listAllUsers().catch(() => []),
    getCachedModelss().then((all) => filterActiveModelsForAssignment(all)).catch(() => []),
  ]);

  const userOptions = filterActiveUsersForAssignment(users)
    .filter((u) => u.role === "chatter" || u.role === "virtual_assistant")
    .map((u) => ({
      id: u.id,
      name: (u.full_name ?? "").trim() || u.email || u.id,
      user_role: u.role === "virtual_assistant" ? ("va" as const) : ("chatter" as const),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const modelOptions = modelss
    .map((m) => ({
      id: m.id,
      name: m.model_name.trim() || m.id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <AdminFinesBonusesClient
        initialEntries={entries}
        userOptions={userOptions}
        modelOptions={modelOptions}
        isAdmin={session.role === "admin"}
      />
    </div>
  );
}
