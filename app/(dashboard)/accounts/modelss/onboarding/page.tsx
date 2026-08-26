import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { ModelOnboardingWizard } from "@/components/model-onboarding-wizard";

export default async function ModelOnboardingPage() {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.ACCOUNTS_CREATE))) {
    redirect(ROUTES.dashboard);
  }

  return (
    <div className="space-y-4">
      <Link href={ROUTES.accountsModelss} className="text-sm text-white/55 hover:text-white/80">
        ← Accounts
      </Link>
      <ModelOnboardingWizard />
    </div>
  );
}
