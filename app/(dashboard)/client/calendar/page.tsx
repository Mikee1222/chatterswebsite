import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getCalendarEvents } from "@/services/client-portal";
import { formatDateTime } from "@/lib/format-date";
import { Calendar, Globe } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientCalendarPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  const events = await getCalendarEvents(user.id);
  const now = Date.now();
  const upcoming = events
    .filter((e) => new Date(e.start_datetime).getTime() >= now)
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Calendar</h1>
        <p className="mt-1 text-sm text-white/55">Upcoming payment windows and events</p>
      </div>

      {upcoming.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-white/25" />
          <p className="font-medium text-white">No upcoming events</p>
          <p className="mt-1 text-sm text-white/50">Check back later for scheduled payment windows.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.map((event) => (
            <div
              key={event.id}
              className="glass-card flex gap-4 rounded-2xl border border-white/10 p-5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 text-pink-300">
                {event.scope === "global" ? (
                  <Globe className="h-5 w-5" />
                ) : (
                  <Calendar className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{event.title}</p>
                <p className="mt-1 text-sm text-white/55">
                  {formatDateTime(event.start_datetime)}
                  {event.end_datetime && (
                    <> – {formatDateTime(event.end_datetime)}</>
                  )}
                </p>
                {event.notes && (
                  <p className="mt-2 text-sm text-white/45">{event.notes}</p>
                )}
                <span className="mt-2 inline-block rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/40">
                  {event.scope === "global" ? "Agency-wide" : "Your account"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
