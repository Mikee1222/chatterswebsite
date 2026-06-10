import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getUserByAirtableId, listAllUsers } from "@/services/users";
import { redirect, notFound } from "next/navigation";
import { EditAccountForm } from "@/components/edit-account-form";
import { listAllModelss } from "@/services/modelss";
import { getRoles } from "@/services/roles";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionFromCookies();
  if (user?.role !== "admin") redirect(ROUTES.dashboard);

  const { id } = await params;
  const record = await getUserByAirtableId(id);
  if (!record) notFound();
  const [allModels, allUsers, roles] = await Promise.all([
    listAllModelss(),
    listAllUsers(),
    getRoles(),
  ]);
  const linkedModelIds = new Set(
    allUsers
      .filter((u) => u.role === "model")
      .map((u) => u.linked_model_id)
      .filter((mid): mid is string => Boolean(mid?.trim()))
  );
  const modelOptions = allModels
    .map((m) => ({
      id: m.id,
      model_name: m.model_name,
      alreadyLinked: linkedModelIds.has(m.id),
    }))
    .sort((a, b) => a.model_name.localeCompare(b.model_name));

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-semibold text-white">Edit user</h1>
      <div className="glass-card p-6">
        <EditAccountForm user={record} roles={roles} modelOptions={modelOptions} />
      </div>
    </div>
  );
}
