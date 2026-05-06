import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { AdminModelOpsPlaceholder } from "@/components/admin-model-ops-placeholder";

export default async function AdminModelLiveStreamsPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  return (
    <AdminModelOpsPlaceholder
      title="Model live streams"
      description="Use live shifts and the models list to coordinate who is on and when. A dedicated streams dashboard can be added here later."
      links={[
        { href: ROUTES.admin.liveShifts, label: "Live shifts" },
        { href: ROUTES.admin.models, label: "Models" },
        { href: ROUTES.admin.whales, label: "Whales" },
      ]}
    />
  );
}
