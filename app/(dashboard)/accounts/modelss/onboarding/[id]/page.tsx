import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getModelById } from "@/services/modelss";
import { ModelOnboardingWizard } from "@/components/model-onboarding-wizard";

export default async function ResumeModelOnboardingPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getSessionFromCookies();
  if (
    !user ||
    !(
      (await hasPermission(user, PERMISSIONS.ACCOUNTS_CREATE)) ||
      (await hasPermission(user, PERMISSIONS.ACCOUNTS_EDIT))
    )
  ) {
    redirect(ROUTES.dashboard);
  }

  const id = params.id?.trim();
  if (!id) notFound();
  const model = await getModelById(id);
  if (!model) notFound();

  // Resume after basic info (step 1 index) unless nothing linked yet
  let startStep = 1;
  if (!model.infloww_creator_id?.trim()) startStep = 1;
  else startStep = 2;

  return (
    <div className="space-y-4">
      <Link href={ROUTES.accountsModelss} className="text-sm text-white/55 hover:text-white/80">
        ← Accounts
      </Link>
      <ModelOnboardingWizard initialModelId={model.id} initialStep={startStep} />
    </div>
  );
}
