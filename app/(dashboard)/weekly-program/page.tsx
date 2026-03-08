import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getProgramsForWeekAndChatter } from "@/services/weekly-program";
import { listAllModelss } from "@/services/modelss";
import { formatTimeFromISO } from "@/lib/format";
import { normalizeWeekStart, getThisWeekMonday, formatWeekLabel } from "@/lib/weekly-program";
import { WeeklyProgramDaySwiper } from "@/components/weekly-program-day-swiper";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function WeeklyProgramPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "chatter") redirect(ROUTES.dashboard);

  const chatterId = user.airtableUserId ?? user.id;
  const weekStart = normalizeWeekStart(getThisWeekMonday());
  const [entries, modelss] = await Promise.all([
    getProgramsForWeekAndChatter(weekStart, chatterId).catch(() => []),
    listAllModelss().catch(() => []),
  ]);
  const idToName: Record<string, string> = {};
  modelss.forEach((m) => {
    idToName[m.id] = m.model_name ?? m.id;
  });

  const byDay = DAY_ORDER.map((day) => ({
    day,
    entries: entries
      .filter((e) => e.day === day)
      .sort((a, b) => (a.shift_type === "Morning" ? 0 : 1) - (b.shift_type === "Morning" ? 0 : 1)),
  }));

  const totalShifts = entries.length;
  const workingDays = new Set(entries.map((e) => e.day)).size;
  const assignedModelIds = new Set(entries.flatMap((e) => e.model_ids).filter(Boolean));
  const modelCount = assignedModelIds.size;

  return (
    <div className="space-y-8">
      {/* Hero: premium title block + week + summary */}
      <div
        className="glass-panel p-8 md:p-10"
        style={{
          boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 48px -12px hsl(330 80% 55% / 0.12)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Your schedule
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Weekly program
        </h1>
        <p className="mt-2 text-white/60">
          Week starting {formatWeekLabel(weekStart)}. Morning 12:00–20:00, Night 20:00–03:00.
        </p>

        {entries.length > 0 && (
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                Shifts this week
              </p>
              <p className="mt-1 font-mono text-2xl tabular-nums text-[hsl(330,90%,75%)] md:text-3xl" style={{ textShadow: "0 0 20px hsl(330 80% 55% / 0.25)" }}>
                {totalShifts}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                Working days
              </p>
              <p className="mt-1 text-xl font-medium text-white/95">{workingDays}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                Assigned models
              </p>
              <p className="mt-1 text-xl font-medium text-white/95">{modelCount}</p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: day swiper */}
      {entries.length > 0 && (
        <WeeklyProgramDaySwiper byDay={byDay} weekStart={weekStart} idToName={idToName} />
      )}

      {/* Desktop: week by day cards */}
      {entries.length > 0 && (
      <div className="hidden md:block space-y-6">
        {byDay.map(({ day, entries: dayEntries }) => (
          <div
            key={day}
            className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl"
            style={{
              boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 32px -8px hsl(330 80% 55% / 0.08)",
            }}
          >
            <div className="border-b border-white/10 bg-white/[0.04] px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/90">
                {day}
              </h2>
            </div>
            <div className="p-4 md:p-5">
              {dayEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-10 text-center">
                  <p className="text-sm text-white/50">No shifts scheduled</p>
                  <p className="mt-0.5 text-xs text-white/40">Rest day</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {dayEntries.map((e) => (
                    <li
                      key={e.id}
                      className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 transition hover:bg-white/[0.06]"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className="rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[hsl(330,90%,75%)]"
                          style={{
                            borderColor: "hsl(330 80% 55% / 0.4)",
                            backgroundColor: "hsl(330 80% 55% / 0.12)",
                            boxShadow: "0 0 12px -4px hsl(330 80% 55% / 0.2)",
                          }}
                        >
                          {e.shift_type}
                        </span>
                        <span className="font-mono text-sm tabular-nums text-white/90">
                          {formatTimeFromISO(e.start_time)} – {formatTimeFromISO(e.end_time)}
                        </span>
                      </div>
                      {e.model_ids.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {e.model_ids.map((id) => (
                            <span
                              key={id}
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90"
                            >
                              {idToName[id] || id}
                            </span>
                          ))}
                        </div>
                      )}
                      {e.notes?.trim() && (
                        <p className="text-xs text-white/50 leading-relaxed">
                          {e.notes.trim().length > 80
                            ? `${e.notes.trim().slice(0, 80)}…`
                            : e.notes.trim()}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {entries.length === 0 && (
        <div
          className="glass-card flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 p-12 text-center"
          style={{
            boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.06)",
          }}
        >
          <p className="text-base font-medium text-white/70">
            No scheduled shifts for this week yet.
          </p>
          <p className="text-sm text-white/50">
            Your weekly program will appear here when assigned.
          </p>
        </div>
      )}
    </div>
  );
}
