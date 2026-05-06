import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { FormCard } from "@/components/ui/form";
import { CreateAccountForm } from "@/components/create-account-form";
import type { UserRole } from "@/types";

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

  return (
    <div className="max-w-md">
      <FormCard title="Create user" subtitle="Add a new account">
        <CreateAccountForm defaultRole={defaultRole} />
      </FormCard>
    </div>
  );
}
