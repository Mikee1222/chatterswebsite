import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { FormCard } from "@/components/ui/form";
import { CreateAccountForm } from "@/components/create-account-form";
import { listAllModelss } from "@/services/modelss";
import { listAllUsers } from "@/services/users";
import { getRoles } from "@/services/roles";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

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
    .map((m) => ({
      id: m.id,
      model_name: m.model_name,
      alreadyLinked: linkedModelIds.has(m.id),
    }))
    .sort((a, b) => a.model_name.localeCompare(b.model_name));

  return (
    <div className="max-w-md">
      <FormCard title="Create user" subtitle="Add a new account">
        <CreateAccountForm roles={roles} defaultRole={defaultRole} modelOptions={modelOptions} />
      </FormCard>
    </div>
  );
}
