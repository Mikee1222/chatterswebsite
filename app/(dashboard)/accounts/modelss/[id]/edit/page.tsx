import Link from "next/link";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getModelById } from "@/services/modelss";
import { listAllUsers } from "@/services/users";
import { redirect, notFound } from "next/navigation";
import { EditModelForm } from "@/components/edit-model-form";

export default async function EditModelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionFromCookies();
  if (user?.role !== "admin") redirect(ROUTES.dashboard);

  const { id } = await params;
  const model = await getModelById(id);
  if (!model) notFound();
  const allUsers = await listAllUsers();
  const modelUsers = allUsers.filter((u) => u.role === "model");
  const currentLinkedUser = modelUsers.find((u) => u.linked_model_id === model.id) ?? null;
  const userOptions = modelUsers
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
        />
      </div>
    </div>
  );
}
