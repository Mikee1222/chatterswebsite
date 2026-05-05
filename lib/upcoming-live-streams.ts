import type { ModelLiveStreamRecord } from "@/types";
import { getTodayYmd } from "@/lib/weekly-program";

function isTerminalStatus(status: string): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "completed" || s === "cancelled" || s === "missed";
}

export function filterUpcomingLiveStreams(streams: ModelLiveStreamRecord[]): ModelLiveStreamRecord[] {
  const today = getTodayYmd();
  const nowHm = new Date().toTimeString().slice(0, 5);
  return [...streams]
    .filter((s) => !isTerminalStatus(s.status))
    .filter((s) => s.date > today || (s.date === today && (s.planned_start ?? "00:00") >= nowHm))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.planned_start ?? "").localeCompare(b.planned_start ?? ""));
}

export async function getUpcomingStreams(streams: ModelLiveStreamRecord[]): Promise<ModelLiveStreamRecord[]> {
  return filterUpcomingLiveStreams(streams);
}
