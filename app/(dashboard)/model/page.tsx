import Link from "next/link";
import { getModelContext } from "@/lib/model-context-server";
import { ROUTES } from "@/lib/routes";
import { listModelScheduleItems } from "@/services/model-schedule";
import { listCustomRequestsByModel } from "@/services/custom-requests";
import { listModelLiveStreams } from "@/services/model-live-streams";
import { filterUpcomingLiveStreams } from "@/lib/upcoming-live-streams";
import { listModelTasks } from "@/services/model-tasks";
import { getTodayYmd, getThisWeekMonday, addDays } from "@/lib/weekly-program";
import { getCurrentPeriod, getPeriodsForModel, getUpcomingPeriod } from "@/services/model-periods";
import { ModelPeriodHomeSection } from "@/components/model-period-home-section";
import { formatDateLong, formatTimeRange } from "@/lib/format";
import { modelLiveStreamPlatformLabel } from "@/lib/airtable-options";

export default async function ModelHomePage() {
  const { user, modelRecord, linkedModelId, language } = await getModelContext();

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Home</h1>
        <p className="text-white/70">Please log in to view your home.</p>
      </div>
    );
  }

  if (!linkedModelId || !modelRecord) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Home</h1>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Your account is not linked to a model profile. Contact an admin to link your account to a model.
        </p>
      </div>
    );
  }

  const today = getTodayYmd();
  const weekStart = getThisWeekMonday();
  const weekEnd = addDays(weekStart, 6);

  const [scheduleToday, scheduleWeek, customs, liveStreams, tasks, currentPeriod, periods] = await Promise.all([
    listModelScheduleItems(linkedModelId, { fromDate: today, toDate: today }),
    listModelScheduleItems(linkedModelId, { fromDate: weekStart, toDate: weekEnd }),
    listCustomRequestsByModel(linkedModelId),
    listModelLiveStreams(linkedModelId),
    listModelTasks(linkedModelId),
    getCurrentPeriod(linkedModelId).catch(() => null),
    getPeriodsForModel(linkedModelId).catch(() => []),
  ]);

  const upcomingPeriod = await getUpcomingPeriod(linkedModelId, modelRecord).catch(() => null);
  const defaultLen =
    typeof modelRecord.avg_period_length === "number" && modelRecord.avg_period_length > 0
      ? Math.min(14, Math.round(modelRecord.avg_period_length))
      : 5;

  // Scheduled customs: only future (scheduled date in future, or today with start time not yet passed)
  const nowTime = new Date().toTimeString().slice(0, 5);
  const scheduledCustoms = customs
    .filter(
      (c) =>
        c.model_status === "scheduled" &&
        c.model_scheduled_date &&
        (c.model_scheduled_date > today ||
          (c.model_scheduled_date === today && (c.model_scheduled_start ?? "00:00") >= nowTime))
    )
    .sort(
      (a, b) =>
        (a.model_scheduled_date ?? "").localeCompare(b.model_scheduled_date ?? "") ||
        (a.model_scheduled_start ?? "").localeCompare(b.model_scheduled_start ?? "")
    );

  // Upcoming lives: future only — exclude completed/cancelled/missed and past scheduled time (no fallback to last completed)
  const upcomingLives = filterUpcomingLiveStreams(liveStreams);
  const nextLive = upcomingLives[0] ?? null;

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const nextCustom = scheduledCustoms[0] ?? null;

  const allToday = [...scheduleToday].sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  // Next on schedule: first item whose start is still in the future (today or later, start_time >= now)
  const futureScheduleItems = scheduleWeek
    .filter(
      (i) => i.date > today || (i.date === today && (i.start_time ?? "00:00") >= nowTime)
    )
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  const nextScheduledItem = futureScheduleItems[0] ?? null;

  const displayName = modelRecord.model_name || user.fullName || "Model";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Home</h1>
        <p className="mt-1 text-white/60">Welcome back, {displayName}</p>
      </div>

      {/* Today overview */}
      <section className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
          {language === "es" ? "Hoy" : "Today"} · {formatDateLong(today, language === "es" ? "es" : "en-GB")}
        </h2>
        {allToday.length === 0 ? (
          <p className="mt-3 text-sm text-white/50">{language === "es" ? "Sin programación hoy." : "No schedule items today."}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {allToday.map((item) => (
              <li key={item.id}>
                <Link
                  href={ROUTES.model.schedule}
                  className="block rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 transition-colors hover:bg-white/[0.1]"
                >
                  <span className="font-medium text-white/90">{item.title || item.item_type}</span>
                  <span className="ml-2 text-sm text-white/60">
                    {formatTimeRange(item.start_time, item.end_time)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ModelPeriodHomeSection
        modelId={linkedModelId}
        language={language}
        currentPeriod={currentPeriod}
        predictedNextStart={upcomingPeriod?.predicted_start ?? null}
        periods={periods}
        defaultPeriodLengthDays={defaultLen}
      />

      {/* Quick stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pendingTasks.length > 0 && (
          <Link
            href={ROUTES.model.tasks}
            className="glass-card flex flex-col gap-1 p-5 transition-colors hover:bg-white/5"
          >
            <p className="text-2xl font-semibold text-white">{pendingTasks.length}</p>
            <p className="text-sm text-white/60">{language === "es" ? "Tareas pendientes" : "Pending tasks"}</p>
          </Link>
        )}
        {scheduledCustoms.length > 0 && (
          <Link
            href={ROUTES.model.customs}
            className="glass-card flex flex-col gap-1 p-5 transition-colors hover:bg-white/5"
          >
            <p className="text-2xl font-semibold text-white">{scheduledCustoms.length}</p>
            <p className="text-sm text-white/60">{language === "es" ? "Personalizados programados" : "Scheduled customs"}</p>
          </Link>
        )}
        {upcomingLives.length > 0 && (
          <Link
            href={ROUTES.model.liveStreams}
            className="glass-card flex flex-col gap-1 p-5 transition-colors hover:bg-white/5"
          >
            <p className="text-2xl font-semibold text-white">{upcomingLives.length}</p>
            <p className="text-sm text-white/60">{language === "es" ? "Lives próximos" : "Upcoming lives"}</p>
          </Link>
        )}
      </div>

      {/* Next scheduled item */}
      {nextScheduledItem && (
        <section className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
            {language === "es" ? "Siguiente en programa" : "Next on schedule"}
          </h2>
          <Link
            href={ROUTES.model.schedule}
            className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.06] px-4 py-4 transition-colors hover:bg-white/[0.1]"
          >
            <div>
              <p className="font-medium text-white/90">{nextScheduledItem.title || nextScheduledItem.item_type}</p>
              <p className="mt-0.5 text-sm text-white/60">
                {formatDateLong(nextScheduledItem.date, language === "es" ? "es" : "en-GB")}
                {" · "}
                {formatTimeRange(nextScheduledItem.start_time, nextScheduledItem.end_time)}
              </p>
            </div>
            <span className="text-sm text-white/50">→</span>
          </Link>
        </section>
      )}

      {/* Next upcoming custom */}
      {nextCustom && (
        <section className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
            {language === "es" ? "Próximo personalizado" : "Next upcoming custom"}
          </h2>
          <Link
            href={ROUTES.model.customs}
            className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.06] px-4 py-4 transition-colors hover:bg-white/[0.1]"
          >
            <div>
              <p className="font-medium text-white/90">{nextCustom.request_title || "Custom"}</p>
              <p className="mt-0.5 text-sm text-white/60">
                {nextCustom.model_scheduled_date ? formatDateLong(nextCustom.model_scheduled_date, language === "es" ? "es" : "en-GB") : "—"}
                {nextCustom.model_scheduled_start && nextCustom.model_scheduled_end && (
                  <> · {formatTimeRange(nextCustom.model_scheduled_start, nextCustom.model_scheduled_end)}</>
                )}
              </p>
              {nextCustom.fan_username && (
                <p className="mt-0.5 text-xs text-white/50">Fan: {nextCustom.fan_username}</p>
              )}
            </div>
            <span className="text-sm text-white/50">→</span>
          </Link>
        </section>
      )}

      {/* Next upcoming live */}
      {nextLive && (
        <section className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
            {language === "es" ? "Próximo live" : "Next upcoming live"}
          </h2>
          <Link
            href={ROUTES.model.liveStreams}
            className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.06] px-4 py-4 transition-colors hover:bg-white/[0.1]"
          >
            <div>
              <p className="font-medium text-white/90">
                {nextLive.platform ? `${modelLiveStreamPlatformLabel(nextLive.platform)} live` : "Live stream"}
              </p>
              <p className="mt-0.5 text-sm text-white/60">
                {formatDateLong(nextLive.date, language === "es" ? "es" : "en-GB")}
                {nextLive.planned_start && nextLive.planned_end && (
                  <> · {formatTimeRange(nextLive.planned_start, nextLive.planned_end)}</>
                )}
              </p>
            </div>
            <span className="text-sm text-white/50">→</span>
          </Link>
        </section>
      )}

      {/* Shortcuts */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href={ROUTES.model.schedule} className="glass-card flex flex-col gap-1 p-5 transition-colors hover:bg-white/5">
          <p className="font-medium text-white">Schedule</p>
          <p className="text-sm text-white/60">{language === "es" ? "Ver programa completo" : "View full schedule"}</p>
        </Link>
        <Link href={ROUTES.model.tasks} className="glass-card flex flex-col gap-1 p-5 transition-colors hover:bg-white/5">
          <p className="font-medium text-white">Tasks</p>
          <p className="text-sm text-white/60">{language === "es" ? "Tareas y actualizaciones" : "Tasks and updates"}</p>
        </Link>
        <Link href={ROUTES.model.customs} className="glass-card flex flex-col gap-1 p-5 transition-colors hover:bg-white/5">
          <p className="font-medium text-white">Customs</p>
          <p className="text-sm text-white/60">{language === "es" ? "Personalizados asignados" : "Assigned customs"}</p>
        </Link>
        <Link href={ROUTES.model.liveStreams} className="glass-card flex flex-col gap-1 p-5 transition-colors hover:bg-white/5">
          <p className="font-medium text-white">Live streams</p>
          <p className="text-sm text-white/60">{language === "es" ? "Lives y programación" : "Lives and schedule"}</p>
        </Link>
        <Link href={ROUTES.model.weeklyAvailability} className="glass-card flex flex-col gap-1 p-5 transition-colors hover:bg-white/5">
          <p className="font-medium text-white">Weekly availability</p>
          <p className="text-sm text-white/60">{language === "es" ? "Enviar disponibilidad" : "Submit availability"}</p>
        </Link>
        <Link href={ROUTES.model.settings} className="glass-card flex flex-col gap-1 p-5 transition-colors hover:bg-white/5">
          <p className="font-medium text-white">Settings</p>
          <p className="text-sm text-white/60">{language === "es" ? "Idioma y preferencias" : "Language and preferences"}</p>
        </Link>
      </div>
    </div>
  );
}
