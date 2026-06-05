"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { enGB } from "date-fns/locale";
import type { CalendarEventRecord } from "@/types/client-portal";
import { ChevronLeft, ChevronRight, Calendar, Clock, CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "upcoming" | "completed" | "cancelled";
type EventStatus = "confirmed" | "pending" | "cancelled";

type Props = {
  events: CalendarEventRecord[];
  icsUrl?: string | null;
  webcalUrl?: string | null;
  googleCalendarUrl?: string | null;
};

const resolveEventStatus = (event: CalendarEventRecord): EventStatus => {
  const raw = event.notes?.includes("cancelled") ? "cancelled" : "confirmed";
  void raw;
  return "confirmed";
};

const statusConfig: Record<EventStatus, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  confirmed: {
    label: "Confirmed",
    tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pending",
    tone: "text-amber-300 bg-amber-500/10 border-amber-500/30",
    icon: Clock,
  },
  cancelled: {
    label: "Cancelled",
    tone: "text-red-300 bg-red-500/10 border-red-500/30",
    icon: AlertCircle,
  },
};

export function ClientWeeklyPaymentsCalendar({
  events,
  webcalUrl,
  googleCalendarUrl,
}: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("upcoming");

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  useEffect(() => {
    if (!isSameMonth(selectedDay, currentDate)) {
      setSelectedDay(monthStart);
    }
  }, [currentDate, monthStart, selectedDay]);

  const filteredEvents = useMemo(() => {
    const now = new Date();
    return events.filter((event) => {
      const status = resolveEventStatus(event);
      const end = new Date(event.end_datetime);
      if (statusFilter === "cancelled") return status === "cancelled";
      if (statusFilter === "upcoming") return status !== "cancelled" && end >= now;
      if (statusFilter === "completed") return end < now && status !== "cancelled";
      return true;
    });
  }, [events, statusFilter]);

  const eventsForDay = useMemo(() => {
    const dayStart = startOfDay(selectedDay);
    const dayEnd = endOfDay(selectedDay);
    return filteredEvents.filter((event) => {
      const eventStart = startOfDay(new Date(event.start_datetime));
      const eventEnd = new Date(event.end_datetime);
      return eventStart <= dayEnd && eventEnd > dayStart;
    });
  }, [filteredEvents, selectedDay]);

  useEffect(() => {
    if (eventsForDay.length === 0) {
      setSelectedEvent(null);
      return;
    }
    if (!selectedEvent || !eventsForDay.some((event) => event.id === selectedEvent.id)) {
      setSelectedEvent(eventsForDay[0]);
    }
  }, [eventsForDay, selectedEvent]);

  const getEventsForDay = (day: Date) => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    return filteredEvents.filter((event) => {
      const eventStart = startOfDay(new Date(event.start_datetime));
      const eventEnd = new Date(event.end_datetime);
      return eventStart <= dayEnd && eventEnd > dayStart;
    });
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition-colors hover:border-violet-400/40 hover:text-white"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            {format(currentDate, "MMMM yyyy")}
          </div>
          <button
            type="button"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition-colors hover:border-violet-400/40 hover:text-white"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["all", "upcoming", "completed", "cancelled"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all",
                statusFilter === status
                  ? "border-violet-400/30 bg-violet-500/15 text-violet-200"
                  : "border-white/10 bg-white/5 text-gray-400 hover:border-violet-400/30 hover:text-gray-200"
              )}
            >
              {status.replace("_", " ")}
            </button>
          ))}
        </div>

        {(webcalUrl || googleCalendarUrl) && (
          <div className="flex flex-wrap items-center gap-2">
            {webcalUrl && (
              <a
                href={webcalUrl}
                className="rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/30"
              >
                Add to Apple Calendar
              </a>
            )}
            {googleCalendarUrl && (
              <a
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/10"
              >
                Add to Google Calendar
              </a>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="glass-card rounded-2xl p-5 md:p-6">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => (
              <div key={day} className="py-2 text-center text-xs font-semibold uppercase tracking-widest text-white/70">
                {day}
              </div>
            ))}
            {Array.from({ length: monthStart.getDay() }).map((_, index) => (
              <div key={`empty-${index}`} className="h-20 md:h-28" />
            ))}
            {daysInMonth.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              const isSelected = isSameDay(day, selectedDay);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "h-20 rounded-xl border p-2 text-left transition-all md:h-28",
                    isSelected
                      ? "border-violet-400/50 bg-white/15 ring-1 ring-violet-400/30"
                      : "border-white/10 bg-white/5 hover:border-violet-400/30 hover:bg-white/10",
                    isToday && !isSelected ? "border-violet-400/30 ring-1 ring-violet-400/20" : ""
                  )}
                >
                  <div
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      isSelected ? "text-violet-200" : isToday ? "text-violet-300" : "text-white"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="mt-2 space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className="w-full truncate rounded-lg border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-left text-[10px] font-medium text-violet-100 md:text-xs"
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] font-medium text-gray-300">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Selected day</p>
              <h3 className="text-xl font-semibold text-white">
                {format(selectedDay, "EEEE, d MMM", { locale: enGB })}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <Calendar className="h-5 w-5 text-violet-300" />
            </div>
          </div>

          {eventsForDay.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400">
              No events scheduled for this day.
            </div>
          ) : (
            <div className="space-y-3">
              {eventsForDay.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEvent(event)}
                  className={cn(
                    "w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-all",
                    selectedEvent?.id === event.id
                      ? "border-violet-400/30 bg-white/10"
                      : "hover:border-violet-400/20 hover:bg-white/10"
                  )}
                >
                  <p className="text-sm text-gray-400">
                    {format(new Date(event.start_datetime), "PPp", { locale: enGB })}
                  </p>
                  <p className="mt-1 text-base font-semibold text-white">{event.title}</p>
                </button>
              ))}
            </div>
          )}

          {selectedEvent && (
            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Event details</p>
                  <h4 className="mt-1 text-lg font-semibold text-white">{selectedEvent.title}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 hover:text-white"
                  aria-label="Close details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Start</span>
                  <span className="text-white">
                    {format(new Date(selectedEvent.start_datetime), "PPp", { locale: enGB })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">End</span>
                  <span className="text-white">
                    {format(new Date(selectedEvent.end_datetime), "PPp", { locale: enGB })}
                  </span>
                </div>
                {selectedEvent.notes && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-gray-200">
                    {selectedEvent.notes}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
