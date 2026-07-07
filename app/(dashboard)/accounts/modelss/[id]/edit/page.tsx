import Link from "next/link";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getClientModelAssignmentsForModel } from "@/services/client-portal";
import { getModelById } from "@/services/modelss";
import { isUserActiveForAssignment } from "@/lib/assignment-filters";
import { listAllUsers } from "@/services/users";
import { redirect, notFound } from "next/navigation";
import { EditModelForm } from "@/components/edit-model-form";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export default async function EditModelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.ACCOUNTS_EDIT))) redirect(ROUTES.dashboard);

  const { id } = await params;
  const [model, clientAssignments, allUsers] = await Promise.all([
    getModelById(id),
    getClientModelAssignmentsForModel(id),
    listAllUsers(),
  ]);
  if (!model) notFound();
  const modelUsers = allUsers.filter((u) => u.role === "model");
  const currentLinkedUser = modelUsers.find((u) => u.linked_model_id === model.id) ?? null;
  const userOptions = modelUsers
    .filter((u) => isUserActiveForAssignment(u) || u.id === currentLinkedUser?.id)
    .map((u) => ({
      id: u.id,
      name: u.full_name?.trim() || u.email,
      email: u.email,
      alreadyLinked: Boolean(u.linked_model_id?.trim()),
      linkedToThisModel: u.linked_model_id === model.id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.accountsModelss}
          className="text-sm text-white/60 hover:text-white"
        >
          ← Accounts
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-white">Edit model</h1>
      <div className="glass-card p-6">
        <EditModelForm
          model={model}
          userOptions={userOptions}
          currentLinkedUserId={currentLinkedUser?.id ?? ""}
          clientAssignments={clientAssignments}
        />
      </div>
    </div>
  );
}
