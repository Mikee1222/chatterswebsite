import type { AdminScheduleOverviewRow } from "@/lib/admin-schedule-overview-rows";
import { buildAdminScheduleOverviewRows } from "@/lib/admin-schedule-overview-rows";
import { batchAsync } from "@/lib/utils";
import { addDays, addWeeks, getThisWeekMonday, getTodayYmd, parseWeekStart } from "@/lib/weekly-program";
import { listAcceptedCustomRequestsInDateRange } from "@/services/custom-requests";
import { getCurrentPeriod, getPeriodsForModel, getUpcomingPeriod } from "@/services/model-periods";
import { listAllModelLiveStreamsInRange } from "@/services/model-live-streams";
import { listAllModelScheduleItemsInRange } from "@/services/model-schedule";
import { listAllModelss } from "@/services/modelss";
import { listModelPersonalEventsInDateRange } from "@/services/model-personal-events";
import { listAllUsers } from "@/services/users";
import { listAllVAContentAssignmentsInRange } from "@/services/va-content-assignments";
import type { ModelRecord } from "@/types";

const WEEKS_PAD = 8;

export type ScheduleOverviewPageModelOption = { id: string; name: string };

/** Per-model period snapshot when `trackingEnabled` (otherwise hide period UI entirely). */
export type ScheduleOverviewPeriodIndicator = {
  trackingEnabled: boolean;
  currentlyInPeriod: boolean;
  current: { end_date: string | null } | null;
  /** Day within active bleed window when `currentlyInPeriod`. */
  dayNumber: number | null;
  lastPeriodDate: string | null;
  /** Latest logged start used for prediction (same source as schedule “last”). */
  lastStart: string | null;
  nextExpectedDate: string | null;
  daysUntilNext: number | null;
};

function ymdCalendarDayDiff(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00.000Z`);
  const b = Date.parse(`${toYmd}T12:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

async function computePeriodIndicatorsForModels(models: ModelRecord[]): Promise<Record<string, ScheduleOverviewPeriodIndicator>> {
  const today = getTodayYmd();
  const entries = await batchAsync(
    models,
    async (m) => {
      if (!m.period_tracking_enabled) {
        const empty: ScheduleOverviewPeriodIndicator = {
          trackingEnabled: false,
          currentlyInPeriod: false,
          current: null,
          dayNumber: null,
          lastPeriodDate: null,
          lastStart: null,
          nextExpectedDate: null,
          daysUntilNext: null,
        };
        return [m.id, empty] as const;
      }
      try {
        const [current, upcoming, periods] = await Promise.all([
          getCurrentPeriod(m.id, m),
          getUpcomingPeriod(m.id, m),
          getPeriodsForModel(m.id),
        ]);
        const lastPeriodDate = periods[0]?.start_date ?? null;
        const lastStart = upcoming?.last_start ?? lastPeriodDate;
        const nextExpectedDate = upcoming?.predicted_start ?? null;
        const daysUntilNext = nextExpectedDate != null ? ymdCalendarDayDiff(today, nextExpectedDate) : null;
        return [
          m.id,
          {
            trackingEnabled: true,
            currentlyInPeriod: !!current,
            current: current ? { end_date: current.end_date ?? null } : null,
            dayNumber: current?.day_number ?? null,
            lastPeriodDate,
            lastStart,
            nextExpectedDate,
            daysUntilNext,
          } satisfies ScheduleOverviewPeriodIndicator,
        ] as const;
      } catch {
        return [
          m.id,
          {
            trackingEnabled: true,
            currentlyInPeriod: false,
            current: null,
            dayNumber: null,
            lastPeriodDate: null,
            lastStart: null,
            nextExpectedDate: null,
            daysUntilNext: null,
          } satisfies ScheduleOverviewPeriodIndicator,
        ] as const;
      }
    },
    3,
    200
  );
  return Object.fromEntries(entries);
}

export type ScheduleOverviewPageData = {
  weekStart: string;
  windowStart: string;
  windowEnd: string;
  modelOptions: ScheduleOverviewPageModelOption[];
  rows: AdminScheduleOverviewRow[];
  periodByModelId: Record<string, ScheduleOverviewPeriodIndicator>;
};

/**
 * Shared loader for admin and VA schedule overview pages (±WEEKS_PAD weeks from selected Monday).
 * When `allowedModelIds` is non-null, all lists are filtered to those ids (empty array = empty scope).
 * Pass null for the full agency view (same as admin).
 */
export async function loadScheduleOverviewPageData(opts: {
  weekParam: string;
  /** Restrict to these model record ids; null = all models from listAllModelss(). */
  allowedModelIds: string[] | null;
}): Promise<ScheduleOverviewPageData> {
  const trimmed = opts.weekParam.trim().slice(0, 10);
  const weekStart = parseWeekStart(trimmed) ?? getThisWeekMonday();
  const windowStart = addWeeks(weekStart, -WEEKS_PAD);
  const windowEnd = addDays(addWeeks(weekStart, WEEKS_PAD), 6);

  const allowed: Set<string> | null = opts.allowedModelIds == null ? null : new Set(opts.allowedModelIds);

  const [allModels, scheduleItemsRaw, liveStreamsRaw, customsRaw, vaRaw, personalEventsRaw, users] = await Promise.all([
    listAllModelss().catch(() => []),
    listAllModelScheduleItemsInRange({ fromDate: windowStart, toDate: windowEnd }).catch(() => []),
    listAllModelLiveStreamsInRange({ fromDate: windowStart, toDate: windowEnd }).catch(() => []),
    listAcceptedCustomRequestsInDateRange(windowStart, windowEnd).catch(() => []),
    listAllVAContentAssignmentsInRange(windowStart, windowEnd).catch(() => []),
    listModelPersonalEventsInDateRange(windowStart, windowEnd).catch(() => []),
    listAllUsers().catch(() => []),
  ]);

  const models =
    allowed === null ? allModels : allowed.size === 0 ? [] : allModels.filter((m) => allowed.has(m.id));
  const scheduleItems =
    allowed === null
      ? scheduleItemsRaw
      : allowed.size === 0
        ? []
        : scheduleItemsRaw.filter((s) => allowed.has(s.model_id));
  const liveStreams =
    allowed === null
      ? liveStreamsRaw
      : allowed.size === 0
        ? []
        : liveStreamsRaw.filter((l) => allowed.has(l.model_id));
  const customs =
    allowed === null
      ? customsRaw
      : allowed.size === 0
        ? []
        : customsRaw.filter((c) => allowed.has(c.assigned_model_id));
  const vaAssignments =
    allowed === null
      ? vaRaw
      : allowed.size === 0
        ? []
        : vaRaw.filter((v) => {
            if (allowed.has(v.model_id)) return true;
            const sid = (v.model_id ?? "").trim();
            if (!sid) return false;
            return models.some((m) => allowed.has(m.id) && (m.model_id ?? "").trim() === sid);
          });
  const personalEvents =
    allowed === null
      ? personalEventsRaw
      : allowed.size === 0
        ? []
        : personalEventsRaw.filter((e) => allowed.has(e.model_id));

  const userNamesById = Object.fromEntries(users.map((u) => [u.id, u.full_name?.trim() || u.email || u.id]));

  const rows = buildAdminScheduleOverviewRows({
    models,
    scheduleItems,
    customs,
    vaAssignments,
    liveStreams,
    personalEvents,
    userNamesById,
  });

  const modelOptions = models.map((m) => ({
    id: m.id,
    name: (m.model_name || m.model_id || m.id).trim() || m.id,
  }));

  const periodByModelId = await computePeriodIndicatorsForModels(models);

  return {
    weekStart,
    windowStart,
    windowEnd,
    modelOptions,
    rows,
    periodByModelId,
  };
}
