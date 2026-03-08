import { formatDateTimeEuropean } from "@/lib/format";
import type { ActivityLog } from "@/types";

export function RecentActivity({ logs }: { logs: ActivityLog[] }) {
  if (!logs.length) {
    return <p className="text-sm text-white/50">No recent activity</p>;
  }
  return (
    <ul className="space-y-2">
      {logs.map((log) => (
        <li key={log.id} className="rounded-lg bg-white/5 px-3 py-2 text-sm">
          <span className="font-medium text-white/90">{log.actor_name}</span>
          <span className="text-white/60"> {log.action_type}</span>
          {log.summary && <span className="text-white/50"> — {log.summary}</span>}
          <span className="ml-2 text-xs text-white/40">{formatTime(log.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return formatDateTimeEuropean(d);
  } catch {
    return "";
  }
}
