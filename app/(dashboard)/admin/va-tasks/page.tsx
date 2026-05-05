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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">VA tasks</h1>
        <p className="mt-1 text-sm text-white/60">Create, assign, filter, and manage operational tasks for VAs.</p>
      </div>
      <AdminVaTasksClient tasks={tasks} vaUsers={vaUsers} />
    </div>
  );
}
