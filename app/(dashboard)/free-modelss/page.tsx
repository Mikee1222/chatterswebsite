import { listAllModelss } from "@/services/modelss";
import { FreeModelssTable } from "@/components/free-modelss-table";
import { Select, selectOptionClass, btnSecondaryClass } from "@/components/ui/form";

export default async function FreeModelssPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string; status?: string }>;
}) {
  const params = await searchParams;
  const all = await listAllModelss().catch(() => []);

  let filtered = all;
  if (params.platform) filtered = filtered.filter((m) => m.platform === params.platform);
  if (params.status) filtered = filtered.filter((m) => m.current_status === params.status);

  const free = filtered.filter((m) => m.current_status === "free");
  const occupied = filtered.filter((m) => m.current_status === "occupied");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <Select name="platform" defaultValue={params.platform ?? ""} className="min-w-0">
            <option value="" className={selectOptionClass}>All platforms</option>
            <option value="onlyfans" className={selectOptionClass}>OnlyFans</option>
            <option value="fanvue" className={selectOptionClass}>Fanvue</option>
            <option value="other" className={selectOptionClass}>Other</option>
          </Select>
          <Select name="status" defaultValue={params.status ?? ""} className="min-w-0">
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
