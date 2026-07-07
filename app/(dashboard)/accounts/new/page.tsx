import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { CreateAccountForm } from "@/components/create-account-form";
import { listAllModelss, isModelActiveForAssignment } from "@/services/modelss";
import { listAllUsers } from "@/services/users";
import { getRoles } from "@/services/roles";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import Link from "next/link";

export default async function NewAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.ACCOUNTS_CREATE))) redirect(ROUTES.dashboard);

  const { role: roleParam } = await searchParams;
  const defaultRole =
    roleParam === "chatter" || roleParam === "virtual_assistant" ? roleParam : undefined;
  const [allModels, allUsers, roles] = await Promise.all([
    listAllModelss(),
    listAllUsers(),
    getRoles(),
  ]);
  const linkedModelIds = new Set(
    allUsers
      .filter((u) => u.role === "model")
      .map((u) => u.linked_model_id)
      .filter((id): id is string => Boolean(id?.trim()))
  );
  const modelOptions = allModels
    .filter((m) => isModelActiveForAssignment(m))
    .map((m) => ({
      id: m.id,
      model_name: m.model_name,
      alreadyLinked: linkedModelIds.has(m.id),
    }))
    .sort((a, b) => a.model_name.localeCompare(b.model_name));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={ROUTES.admin.accounts}
          className="text-sm text-white/50 transition hover:text-pink-300"
        >
          ← Back to accounts
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Create user</h1>
        <p className="mt-1 text-sm text-white/55">Add a new account with role and access settings.</p>
      </div>
      <CreateAccountForm roles={roles} defaultRole={defaultRole} modelOptions={modelOptions} />
    </div>
  );
}
