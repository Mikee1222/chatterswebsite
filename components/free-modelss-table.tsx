import { formatDateTimeEuropean } from "@/lib/format";
import type { ModelRecord } from "@/types";

export function FreeModelssTable({
  free,
  occupied,
}: {
  free: ModelRecord[];
  occupied: ModelRecord[];
}) {
  const all = [...free.map((m) => ({ ...m, _section: "free" as const })), ...occupied.map((m) => ({ ...m, _section: "occupied" as const }))];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-white/60">
            <th className="p-3 font-medium">Model name</th>
            <th className="p-3 font-medium">Platform</th>
            <th className="p-3 font-medium">Status</th>
            <th className="p-3 font-medium">Current chatter</th>
            <th className="p-3 font-medium">Entered at</th>
            <th className="p-3 font-medium">Last chatter</th>
            <th className="p-3 font-medium">Last exit at</th>
            <th className="p-3 font-medium">Priority</th>
          </tr>
        </thead>
        <tbody>
          {all.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-8 text-center text-white/50">
                No modelss found
              </td>
            </tr>
          ) : (
            all.map((m) => (
              <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 font-medium text-white/90">{m.model_name}</td>
                <td className="p-3 text-white/70">{m.platform}</td>
                <td className="p-3">
                  <span
                    className={
                      m.current_status === "free"
                        ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400"
                        : "rounded-full bg-[hsl(330,80%,55%)]/20 px-2 py-0.5 text-xs text-[hsl(330,90%,65%)]"
                    }
                  >
                    {m.current_status}
                  </span>
                </td>
                <td className="p-3 text-white/70">{m.current_chatter_name || "—"}</td>
                <td className="p-3 text-white/70">{m.entered_at ? formatDateTimeEuropean(m.entered_at) : "—"}</td>
                <td className="p-3 text-white/70">{m.last_chatter_name || "—"}</td>
                <td className="p-3 text-white/70">{m.last_exit_at ? formatDateTimeEuropean(m.last_exit_at) : "—"}</td>
                <td className="p-3 text-white/70">{m.priority || "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
