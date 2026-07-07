import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listMistakesForAdmin, getAllMistakeReasons } from "@/services/chatter-mistakes";
import { listAllUsers, filterActiveUsersForAssignment } from "@/services/users";
import { listActiveModelsForAssignment } from "@/services/modelss";
import { AdminMistakesClient } from "@/components/admin-mistakes-client";

export default async function AdminMistakesPage() {
  const session = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.MISTAKES_VIEW);

  const [mistakes, reasons, users, models] = await Promise.all([
    listMistakesForAdmin({}).catch(() => []),
    getAllMistakeReasons().catch(() => []),
    listAllUsers().catch(() => []),
    listActiveModelsForAssignment().catch(() => []),
  ]);

  const chatterOptions = filterActiveUsersForAssignment(users)
    .filter((u) => u.role === "chatter")
    .map((u) => ({
      id: u.id,
      name: (u.full_name ?? "").trim() || u.email || "Chatter",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const modelOptions = models
    .map((m) => ({
      id: m.id,
      name: (m.model_name ?? "").trim() || "Model",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <AdminMistakesClient
        initialMistakes={mistakes}
        reasons={reasons}
        chatterOptions={chatterOptions}
        modelOptions={modelOptions}
      />
    </div>
  );
}
