import { listActivityLogs } from "@/services/activity-logs";
import { ActivityLogsTable } from "@/components/activity-logs-table";
import { Input, btnSecondaryClass } from "@/components/ui/form";

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string }>;
}) {
  const params = await searchParams;
  const filterParts: string[] = [];
  if (params.action) filterParts.push(`{action_type} = '${params.action.replace(/'/g, "\\'")}'`);
  if (params.actor) filterParts.push(`FIND('${params.actor.replace(/'/g, "\\'")}', {actor_name})`);
  const filterByFormula = filterParts.length ? `AND(${filterParts.join(", ")})` : undefined;

  const { logs } = await listActivityLogs({
    pageSize: 50,
    filterByFormula,
  }).catch(() => ({ logs: [] }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <Input
            type="text"
            name="actor"
            defaultValue={params.actor}
            placeholder="Actor name"
            className="min-w-[140px]"
          />
          <Input
            type="text"
            name="action"
            defaultValue={params.action}
            placeholder="Action type"
            className="min-w-[140px]"
          />
          <button type="submit" className={btnSecondaryClass}>Filter</button>
        </form>
      </div>
      <div className="glass-card overflow-hidden">
        <ActivityLogsTable logs={logs} />
      </div>
    </div>
  );
}
