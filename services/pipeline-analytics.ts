import { listAllRecords } from "@/lib/airtable-server";
import { isSupabaseBackend } from "@/lib/data-backend";

type EventFields = { stage?: string; action?: string; actor_name?: string; duration_seconds?: number; at?: string };
type ItemFields = { stage?: string; status?: string };
type BunchFields = { creator_name?: string; week?: string; status?: string; created_at?: string; approved_at?: string };

export type StageStat = { stage: string; avgSeconds: number; completed: number; current: number };
export type PersonStat = { name: string; completed: number; totalSeconds: number; avgSeconds: number };
export type BunchStat = { creator_name: string; week: string; status: string; durationSeconds: number | null; };

export type PipelineAnalytics = {
  stages: StageStat[];
  people: PersonStat[];
  bunches: BunchStat[];
  totals: { itemsInFlight: number; itemsDone: number; blocked: number };
};

const STAGES = ["creative", "filming", "icloud_raw", "editing", "icloud_edited", "post"] as const;

export async function getPipelineAnalytics(): Promise<PipelineAnalytics> {
  if (isSupabaseBackend()) return (await import("./pipeline-analytics-supabase")).getPipelineAnalytics();
  const [events, items, bunches] = await Promise.all([
    listAllRecords<EventFields>("content_item_events", {}).catch(() => []),
    listAllRecords<ItemFields>("content_items", {}).catch(() => []),
    listAllRecords<BunchFields>("research_bunches", {}).catch(() => []),
  ]);

  // per-stage avg completion time + completed count (from "completed" events)
  const durBucket: Record<string, number[]> = {};
  const personCount: Record<string, number> = {};
  const personTime: Record<string, number> = {};
  for (const e of events) {
    const f = e.fields;
    if (f.action === "completed") {
      const st = f.stage ?? "";
      const dur = Number(f.duration_seconds ?? 0);
      (durBucket[st] ??= []).push(dur);
      const who = (f.actor_name ?? "").trim();
      if (who) {
        personCount[who] = (personCount[who] ?? 0) + 1;
        personTime[who] = (personTime[who] ?? 0) + dur;
      }
    }
  }

  // current items per stage + totals
  const currentByStage: Record<string, number> = {};
  let itemsDone = 0;
  let blocked = 0;
  let inFlight = 0;
  for (const it of items) {
    const st = it.fields.stage ?? "";
    const status = it.fields.status ?? "";
    currentByStage[st] = (currentByStage[st] ?? 0) + 1;
    if (status === "done") itemsDone += 1;
    else if (status === "blocked_unassigned") blocked += 1;
    else inFlight += 1;
  }

  const stages: StageStat[] = STAGES.map((st) => {
    const arr = durBucket[st] ?? [];
    const avg = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    return { stage: st, avgSeconds: avg, completed: arr.length, current: currentByStage[st] ?? 0 };
  });

  const people: PersonStat[] = Object.entries(personCount)
    .map(([name, completed]) => {
      const total = personTime[name] ?? 0;
      return { name, completed, totalSeconds: total, avgSeconds: completed ? Math.round(total / completed) : 0 };
    })
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  const bunchStats: BunchStat[] = bunches
    .map((b) => {
      const f = b.fields;
      let dur: number | null = null;
      const start = Date.parse(f.created_at ?? "");
      const end = Date.parse(f.approved_at ?? "");
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) dur = Math.round((end - start) / 1000);
      return { creator_name: f.creator_name ?? "", week: f.week ?? "", status: f.status ?? "", durationSeconds: dur };
    })
    .sort((a, b) => b.week.localeCompare(a.week));

  return {
    stages,
    people,
    bunches: bunchStats,
    totals: { itemsInFlight: inFlight, itemsDone, blocked },
  };
}

export function humanDuration(seconds: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
