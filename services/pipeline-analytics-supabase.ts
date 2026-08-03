/**
 * Supabase backend for services/pipeline-analytics.ts
 */
import { sbSelectAll, type SbRow } from "@/lib/supabase-data";
import type { PipelineAnalytics, StageStat, PersonStat, BunchStat } from "./pipeline-analytics";

type EventRow = SbRow & {
  stage?: string | null;
  action?: string | null;
  actor_name?: string | null;
  duration_seconds?: number | null;
  at?: string | null;
};
type ItemRow = SbRow & { stage?: string | null; status?: string | null };
type BunchRow = SbRow & {
  creator_name?: string | null;
  week?: string | null;
  status?: string | null;
  created_at?: string | null;
  approved_at?: string | null;
};

const STAGES = ["creative", "filming", "icloud_raw", "editing", "icloud_edited", "post"] as const;

export async function getPipelineAnalytics(): Promise<PipelineAnalytics> {
  const [events, items, bunches] = await Promise.all([
    sbSelectAll<EventRow>("content_item_events").catch(() => []),
    sbSelectAll<ItemRow>("content_items").catch(() => []),
    sbSelectAll<BunchRow>("research_bunches").catch(() => []),
  ]);

  const durBucket: Record<string, number[]> = {};
  const personCount: Record<string, number> = {};
  const personTime: Record<string, number> = {};
  for (const e of events) {
    if (e.action === "completed") {
      const st = e.stage ?? "";
      const dur = Number(e.duration_seconds ?? 0);
      (durBucket[st] ??= []).push(dur);
      const who = (e.actor_name ?? "").trim();
      if (who) {
        personCount[who] = (personCount[who] ?? 0) + 1;
        personTime[who] = (personTime[who] ?? 0) + dur;
      }
    }
  }

  const currentByStage: Record<string, number> = {};
  let itemsDone = 0;
  let blocked = 0;
  let inFlight = 0;
  for (const it of items) {
    const st = it.stage ?? "";
    const status = it.status ?? "";
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
      let dur: number | null = null;
      const start = Date.parse(b.created_at ?? "");
      const end = Date.parse(b.approved_at ?? "");
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) dur = Math.round((end - start) / 1000);
      return { creator_name: b.creator_name ?? "", week: b.week ?? "", status: b.status ?? "", durationSeconds: dur };
    })
    .sort((a, b) => b.week.localeCompare(a.week));

  return {
    stages,
    people,
    bunches: bunchStats,
    totals: { itemsInFlight: inFlight, itemsDone, blocked },
  };
}
