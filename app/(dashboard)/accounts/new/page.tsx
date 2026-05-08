import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { FormCard } from "@/components/ui/form";
import { CreateAccountForm } from "@/components/create-account-form";
import type { UserRole } from "@/types";
import { listAllModelss } from "@/services/modelss";
import { listAllUsers } from "@/services/users";

export default async function NewAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (user?.role !== "admin") redirect(ROUTES.dashboard);

  const { role: roleParam } = await searchParams;
  const defaultRole: UserRole | undefined =
    roleParam === "chatter" || roleParam === "virtual_assistant" ? roleParam : undefined;
  const [allModels, allUsers] = await Promise.all([listAllModelss(), listAllUsers()]);
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
        <CreateAccountForm defaultRole={defaultRole} modelOptions={modelOptions} />
      </FormCard>
    </div>
  );
}
