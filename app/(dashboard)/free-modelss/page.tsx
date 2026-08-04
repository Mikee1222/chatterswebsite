import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { getCachedModelss } from "@/lib/modelss-cache";
import { FreeModelssTable } from "@/components/free-modelss-table";
import { Select, selectOptionClass, btnSecondaryClass } from "@/components/ui/form";

export default async function FreeModelssPage({
  searchParams,
}: {
  searchParams: { platform?: string; status?: string };
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.SHIFTS_ACTIVE_VIEW))) {
    redirect(ROUTES.dashboard);
  }

  const all = await getCachedModelss().catch(() => []);

  let filtered = all;
  if (searchParams.platform) filtered = filtered.filter((m) => m.platform === searchParams.platform);
  if (searchParams.status) filtered = filtered.filter((m) => m.current_status === searchParams.status);

  const free = filtered.filter((m) => m.current_status === "free");
  const occupied = filtered.filter((m) => m.current_status === "occupied");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <Select name="platform" defaultValue={searchParams.platform ?? ""} className="min-w-0">
            <option value="" className={selectOptionClass}>All platforms</option>
            <option value="onlyfans" className={selectOptionClass}>OnlyFans</option>
            <option value="fanvue" className={selectOptionClass}>Fanvue</option>
            <option value="other" className={selectOptionClass}>Other</option>
          </Select>
          <Select name="status" defaultValue={searchParams.status ?? ""} className="min-w-0">
            <option value="" className={selectOptionClass}>All statuses</option>
            <option value="free" className={selectOptionClass}>Free</option>
            <option value="occupied" className={selectOptionClass}>Occupied</option>
          </Select>
          <button type="submit" className={btnSecondaryClass}>Filter</button>
        </form>
      </div>
      <div className="glass-card overflow-hidden">
        <FreeModelssTable free={free} occupied={occupied} />
      </div>
    </div>
  );
}
