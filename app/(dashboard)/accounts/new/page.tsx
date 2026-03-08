import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { FormCard } from "@/components/ui/form";
import { CreateAccountForm } from "@/components/create-account-form";

export default async function NewAccountPage() {
  const user = await getSessionFromCookies();
  if (user?.role !== "admin") redirect(ROUTES.dashboard);

  return (
    <div className="max-w-md">
      <FormCard title="Create user" subtitle="Add a new account">
        <CreateAccountForm />
      </FormCard>
    </div>
  );
}
