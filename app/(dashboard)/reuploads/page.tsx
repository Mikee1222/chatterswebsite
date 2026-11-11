import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { resolveReuploadAccess } from "@/lib/reupload-access";
import { listReuploadTasks } from "@/services/reupload-queue";
import { ReuploadsClient } from "@/components/reuploads-client";

export default async function ReuploadsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const access = await resolveReuploadAccess(user);
  if (!access) redirect(ROUTES.dashboard);

  const tasks = await listReuploadTasks({ modelIds: access.modelIds }).catch(() => []);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <ReuploadsClient initialTasks={tasks} canManage={access.canManage} />
    </div>
  );
}
