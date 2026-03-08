import type { WeeklyProgramRecord } from "@/types";
import { formatTimeEuropean } from "@/lib/format";

export function WeeklyProgramTable({
  programs,
  weekStart,
  isAdmin,
  modelIdToName = {},
}: {
  programs: WeeklyProgramRecord[];
  weekStart: string;
  isAdmin: boolean;
  modelIdToName?: Record<string, string>;
}) {
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const sorted = [...programs].sort((a, b) => {
    const ai = dayOrder.indexOf(a.day);
    const bi = dayOrder.indexOf(b.day);
    if (ai !== bi) return ai - bi;
    return a.shift_type === "Morning" ? -1 : 1;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-white/60">
            <th className="p-3 font-medium">Day</th>
            {isAdmin && <th className="p-3 font-medium">Chatter</th>}
            <th className="p-3 font-medium">Shift</th>
            <th className="p-3 font-medium">Models</th>
            <th className="p-3 font-medium">Time</th>
            <th className="p-3 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={isAdmin ? 6 : 5} className="p-8 text-center text-white/50">
                No scheduled shifts for this week
              </td>
            </tr>
          ) : (
            sorted.map((p) => (
              <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 text-white/90">{p.day}</td>
                {isAdmin && <td className="p-3 text-white/80">{p.chatter_name || "—"}</td>}
                <td className="p-3 text-white/80">{p.shift_type}</td>
                <td className="p-3 text-white/80">{p.model_ids.map((id) => modelIdToName[id] || id).join(", ") || "—"}</td>
                <td className="p-3 text-white/70">{formatTimeEuropean(p.start_time)} – {formatTimeEuropean(p.end_time)}</td>
                <td className="max-w-[200px] truncate p-3 text-white/60">{p.notes || "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
