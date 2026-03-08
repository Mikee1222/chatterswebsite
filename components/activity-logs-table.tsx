import { formatDateTimeEuropean } from "@/lib/format";
import type { ActivityLog } from "@/types";

export function ActivityLogsTable({ logs }: { logs: ActivityLog[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-white/60">
            <th className="p-3 font-medium">Time</th>
            <th className="p-3 font-medium">Actor</th>
            <th className="p-3 font-medium">Action</th>
            <th className="p-3 font-medium">Summary</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-8 text-center text-white/50">
                No activity logs
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 text-white/70">
                  {formatDateTimeEuropean(log.created_at)}
                </td>
                <td className="p-3 font-medium text-white/90">{log.actor_name}</td>
                <td className="p-3 text-white/80">{log.action_type}</td>
                <td className="p-3 text-white/70">{log.summary || "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
