import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getAllVaTasks } from "@/services/va-tasks";
import { listAllUsers } from "@/services/users";
import { AdminVaTasksClient } from "@/components/admin-va-tasks-client";

export default async function AdminVaTasksPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const [tasks, allUsers] = await Promise.all([getAllVaTasks(), listAllUsers()]);
  const vaUsers = allUsers
    .filter((u) => u.role === "virtual_assistant")
    .map((u) => ({
      id: u.id,
      full_name: u.full_name ?? "",
      email: u.email ?? "",
    }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <AdminVaTasksClient tasks={tasks} vaUsers={vaUsers} />
    </div>
  );
}
