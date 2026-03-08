import Link from "next/link";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { FormCard } from "@/components/ui/form";
import { CreateModelForm } from "@/components/create-model-form";

export default async function NewModelPage() {
  const user = await getSessionFromCookies();
  if (user?.role !== "admin") redirect(ROUTES.dashboard);

  return (
    <div className="max-w-md space-y-4">
      <Link
        href={ROUTES.accountsModelss}
        className="text-sm text-white/55 hover:text-white/80"
      >
        ← Accounts
      </Link>
      <FormCard title="Create model" subtitle="Add a new model to the roster">
        <CreateModelForm />
      </FormCard>
    </div>
  );
}
