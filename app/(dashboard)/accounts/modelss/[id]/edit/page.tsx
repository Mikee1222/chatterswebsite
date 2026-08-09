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
    <div className="space-y-6">
      <div>
        <Link
          href={ROUTES.accountsModelss}
          className="text-sm text-white/50 transition hover:text-pink-300"
        >
          ← Back to accounts
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Edit model</h1>
        <p className="mt-1 text-sm text-white/55">
          {model.model_name} · {model.platform} · {model.status}
        </p>
      </div>
      <EditModelForm
        model={model}
        userOptions={userOptions}
        currentLinkedUserId={currentLinkedUser?.id ?? ""}
        clientAssignments={clientAssignments}
      />
    </div>
  );
}
