"use client";

import * as React from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  ContentPipelineHero,
  NextShootHeroCard,
} from "@/components/content-pipeline-ui";
import {
  FilterBar,
  FilterChip,
  ReviewEmptyState,
  ReviewModalShell,
} from "@/components/manager-review-ui";
import { CountUp, LuxuryStatCard } from "@/components/infloww-performance-ui";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CARD_GLOW,
  VA_FILTER_INPUT,
} from "@/lib/va-tasks-tokens";
import type { FilmingScheduleEntry } from "@/services/filming";
import { cn } from "@/lib/utils";

export type FilmingCalendarModelOption = { model_id: string; model_name: string };

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function FilmingCalendarClient({
  initialEntries,
  models,
  canManage,
}: {
  initialEntries: FilmingScheduleEntry[];
  models: FilmingCalendarModelOption[];
  canManage: boolean;
}) {
  const { addToast } = useToast();
  const [entries, setEntries] = React.useState(initialEntries);
  const [viewMode, setViewMode] = React.useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = React.useState(() => mondayOf(new Date()));
  const [monthCursor, setMonthCursor] = React.useState(() => startOfMonth(new Date()));
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<FilmingScheduleEntry | null>(null);
  const [modelFilter, setModelFilter] = React.useState("all");
  const [form, setForm] = React.useState({
    schedule_date: ymd(new Date()),
    start_time: "10:00",
    end_time: "14:00",
    model_id: "",
    location: "",
    notes: "",
  });

  React.useEffect(() => setEntries(initialEntries), [initialEntries]);

  const range = React.useMemo(() => {
    if (viewMode === "week") {
      return { from: ymd(weekStart), to: ymd(addDays(weekStart, 6)) };
    }
    const first = startOfMonth(monthCursor);
    const gridStart = mondayOf(first);
    const lastDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const gridEnd = addDays(mondayOf(lastDay), 6);
    return { from: ymd(gridStart), to: ymd(gridEnd) };
  }, [viewMode, weekStart, monthCursor]);

  async function reload(r?: { from: string; to: string }) {
    setLoading(true);
    try {
      const f = r?.from ?? range.from;
      const t = r?.to ?? range.to;
      const res = await fetch(
        `/api/filming/schedule?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`,
        { credentials: "include" },
      );
      const data = (await res.json()) as { entries?: FilmingScheduleEntry[] };
      if (res.ok) setEntries(data.entries ?? []);
    } finally {
      setLoading(false);
    }
  }

  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;
  useSupabaseRealtimeRefresh(["filming_schedule"], () => void reloadRef.current(), {
    debounceMs: 700,
  });

  React.useEffect(() => {
    void reload(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const filteredEntries = React.useMemo(() => {
    if (modelFilter === "all") return entries;
    return entries.filter((e) => e.model_id === modelFilter);
  }, [entries, modelFilter]);

  const byDate = React.useMemo(() => {
    const map = new Map<string, FilmingScheduleEntry[]>();
    for (const e of filteredEntries) {
      const list = map.get(e.schedule_date) ?? [];
      list.push(e);
      map.set(e.schedule_date, list);
    }
    return map;
  }, [filteredEntries]);

  const todayStr = ymd(new Date());
  const nextShoot = React.useMemo(() => {
    const upcoming = filteredEntries
      .filter((e) => e.schedule_date >= todayStr)
      .sort((a, b) => {
        const d = a.schedule_date.localeCompare(b.schedule_date);
        if (d !== 0) return d;
        return (a.start_time || "").localeCompare(b.start_time || "");
      });
    return upcoming[0] ?? null;
  }, [filteredEntries, todayStr]);

  const weekShootCount = React.useMemo(() => {
    const ws = mondayOf(new Date());
    const we = ymd(addDays(ws, 6));
    const wf = ymd(ws);
    return filteredEntries.filter((e) => e.schedule_date >= wf && e.schedule_date <= we).length;
  }, [filteredEntries]);

  function openCreate(date?: string) {
    setEditing(null);
    setForm({
      schedule_date: date ?? ymd(new Date()),
      start_time: "10:00",
      end_time: "14:00",
      model_id: models[0]?.model_id ?? "",
      location: "",
      notes: "",
    });
    setShowForm(true);
  }

  function openEdit(e: FilmingScheduleEntry) {
    setEditing(e);
    setForm({
      schedule_date: e.schedule_date,
      start_time: e.start_time || "10:00",
      end_time: e.end_time || "14:00",
      model_id: e.model_id,
      location: e.location,
      notes: e.notes,
    });
    setShowForm(true);
  }

  async function saveForm() {
    if (!form.model_id || !form.schedule_date) {
      addToast(
        winnerVideoLocalToast(`fc-val-${Date.now()}`, "Missing fields", "Model and date are required.", "high"),
      );
      return;
    }
    const model = models.find((m) => m.model_id === form.model_id);
    setBusy(true);
    try {
      if (editing) {
        const res = await fetch(`/api/filming/schedule/${encodeURIComponent(editing.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...form,
            model_name: model?.model_name ?? "",
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          addToast(winnerVideoLocalToast(`fc-err-${Date.now()}`, "Save failed", data.error ?? "Failed", "high"));
          return;
        }
      } else {
        const res = await fetch("/api/filming/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...form,
            model_name: model?.model_name ?? "",
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          addToast(winnerVideoLocalToast(`fc-err-${Date.now()}`, "Create failed", data.error ?? "Failed", "high"));
          return;
        }
      }
      setShowForm(false);
      await reload();
      addToast(winnerVideoLocalToast(`fc-ok-${Date.now()}`, "Saved", "Filming schedule updated.", "normal"));
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id: string) {
    if (!window.confirm("Delete this shoot from the calendar?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/filming/schedule/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(winnerVideoLocalToast(`fc-del-${Date.now()}`, "Delete failed", data.error ?? "Failed", "high"));
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const monthCells = React.useMemo(() => {
    const first = startOfMonth(monthCursor);
    const gridStart = mondayOf(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [monthCursor]);

  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  function ShootChip({ e }: { e: FilmingScheduleEntry }) {
    return (
      <li className="rounded-lg border border-[#FF1493]/20 bg-[#FF1493]/[0.07] p-2">
        <p className="truncate text-xs font-semibold text-white">{e.model_name || "Model"}</p>
        {(e.start_time || e.end_time) && (
          <p className="mt-0.5 text-[10px] text-[#B8B4B8]/60">
            {[e.start_time, e.end_time].filter(Boolean).join(" – ")}
          </p>
        )}
        {e.location ? (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-[#D4AF8C]/80">
            <MapPin className="h-3 w-3 shrink-0" /> {e.location}
          </p>
        ) : null}
        {canManage ? (
          <div className="mt-1.5 flex gap-1">
            <button
              type="button"
              className="rounded p-1 text-[#B8B4B8]/50 hover:text-white"
              onClick={() => openEdit(e)}
              aria-label="Edit shoot"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="rounded p-1 text-[#B8B4B8]/50 hover:text-red-300"
              onClick={() => void removeEntry(e.id)}
              disabled={busy}
              aria-label="Delete shoot"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <ContentPipelineHero
        eyebrow="Filming"
        title="Filming Calendar"
        description={
          canManage
            ? "Schedule shoots for models — they appear on the model schedule automatically."
            : "Read-only view of upcoming filming shoots."
        }
        orb="both"
        actions={
          <>
            <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  viewMode === "week" ? "bg-[#FF1493]/20 text-[#FF1493]" : "text-[#B8B4B8]/60",
                )}
                onClick={() => setViewMode("week")}
              >
                Week
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  viewMode === "month" ? "bg-[#FF1493]/20 text-[#FF1493]" : "text-[#B8B4B8]/60",
                )}
                onClick={() => setViewMode("month")}
              >
                Month
              </button>
            </div>
            {canManage ? (
              <button
                type="button"
                className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-1.5")}
                onClick={() => openCreate()}
              >
                <Plus className="h-4 w-4" /> Add shoot
              </button>
            ) : null}
          </>
        }
        stats={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <LuxuryStatCard
              label="This week"
              value={<CountUp value={weekShootCount} />}
              accent="pink"
              glow
              tooltip="Shoots scheduled in the current calendar week"
            />
            <LuxuryStatCard
              label="In view"
              value={<CountUp value={filteredEntries.length} />}
              accent="champagne"
              tooltip="Shoots visible in the current week/month range"
            />
            <LuxuryStatCard
              label="Models"
              value={<CountUp value={models.length} />}
              accent="white"
              tooltip="Models available for scheduling"
            />
          </div>
        }
      />

      {!canManage && nextShoot ? (
        <NextShootHeroCard
          modelName={nextShoot.model_name || "Model"}
          scheduleDate={nextShoot.schedule_date}
          startTime={nextShoot.start_time}
          endTime={nextShoot.end_time}
          location={nextShoot.location}
        />
      ) : null}

      <FilterBar className={cn(VA_CARD, VA_CARD_GLOW, "space-y-3 p-4")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "inline-flex h-10 w-10 items-center justify-center p-0")}
              onClick={() => {
                if (viewMode === "week") setWeekStart((w) => addDays(w, -7));
                else setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
              }}
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={VA_BTN_SECONDARY}
              onClick={() => {
                if (viewMode === "week") setWeekStart(mondayOf(new Date()));
                else setMonthCursor(startOfMonth(new Date()));
              }}
            >
              Today
            </button>
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "inline-flex h-10 w-10 items-center justify-center p-0")}
              onClick={() => {
                if (viewMode === "week") setWeekStart((w) => addDays(w, 7));
                else setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
              }}
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium text-white">
              {viewMode === "week" ? weekLabel : monthLabel}
            </p>
          </div>
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className={cn(VA_FILTER_INPUT, "min-w-[10rem]")}
          >
            <option value="all">All models</option>
            {models.map((m) => (
              <option key={m.model_id} value={m.model_id}>
                {m.model_name}
              </option>
            ))}
          </select>
        </div>
        {modelFilter !== "all" ? (
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label={`Model: ${models.find((m) => m.model_id === modelFilter)?.model_name ?? modelFilter}`}
              onRemove={() => setModelFilter("all")}
            />
          </div>
        ) : null}
      </FilterBar>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#FF1493]" />
        </div>
      ) : viewMode === "week" ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          {weekDays.map((d, i) => {
            const key = ymd(d);
            const dayEntries = byDate.get(key) ?? [];
            const isToday = key === todayStr;
            return (
              <div
                key={key}
                className={cn(
                  VA_CARD,
                  "min-h-[160px] p-3",
                  isToday && "border-[#FF1493]/35 ring-1 ring-[#FF1493]/20",
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF8C]/60">
                      {DAY_LABELS[i]}
                    </p>
                    <p className={cn("text-sm font-semibold", isToday ? "text-[#FF1493]" : "text-white")}>
                      {d.getDate()}
                    </p>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-[#D4AF8C]/50 hover:bg-white/5 hover:text-[#D4AF8C]"
                      onClick={() => openCreate(key)}
                      aria-label="Add shoot"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <ul className="mt-2 space-y-2">
                  {dayEntries.map((e) => (
                    <ShootChip key={e.id} e={e} />
                  ))}
                  {dayEntries.length === 0 ? (
                    <p className="pt-6 text-center text-[10px] text-[#B8B4B8]/25">—</p>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={cn(VA_CARD, "overflow-hidden p-2 sm:p-3")}>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {DAY_LABELS.map((l) => (
              <p
                key={l}
                className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[#D4AF8C]/55"
              >
                {l}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((d) => {
              const key = ymd(d);
              const inMonth = d.getMonth() === monthCursor.getMonth();
              const dayEntries = byDate.get(key) ?? [];
              const isToday = key === todayStr;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => (canManage ? openCreate(key) : undefined)}
                  className={cn(
                    "min-h-[72px] rounded-xl border p-1.5 text-left transition sm:min-h-[88px]",
                    inMonth
                      ? "border-white/[0.06] bg-[#0A0A0A]/40"
                      : "border-transparent bg-transparent opacity-40",
                    isToday && "border-[#FF1493]/40 ring-1 ring-[#FF1493]/25",
                    canManage && "hover:border-[#D4AF8C]/30",
                  )}
                >
                  <p
                    className={cn(
                      "text-[11px] font-semibold",
                      isToday ? "text-[#FF1493]" : inMonth ? "text-white" : "text-white/40",
                    )}
                  >
                    {d.getDate()}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {dayEntries.slice(0, 2).map((e) => (
                      <li
                        key={e.id}
                        className="truncate rounded bg-[#FF1493]/15 px-1 py-0.5 text-[9px] font-medium text-[#FF1493]"
                        onClick={(ev) => {
                          if (!canManage) return;
                          ev.stopPropagation();
                          openEdit(e);
                        }}
                      >
                        {e.model_name}
                        {e.location ? ` · ${e.location}` : ""}
                      </li>
                    ))}
                    {dayEntries.length > 2 ? (
                      <li className="text-[9px] text-[#B8B4B8]/45">+{dayEntries.length - 2}</li>
                    ) : null}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!loading && filteredEntries.length === 0 ? (
        <ReviewEmptyState
          icon={CalendarDays}
          title="No shoots in this range"
          description={
            canManage
              ? "Add a shoot to populate the calendar — model and location show on each day."
              : "When shoots are scheduled, they appear here."
          }
          action={
            canManage ? (
              <button type="button" className={VA_BTN_PRIMARY} onClick={() => openCreate()}>
                Add shoot
              </button>
            ) : null
          }
        />
      ) : null}

      {showForm && canManage ? (
        <ReviewModalShell
          title={editing ? "Edit shoot" : "Schedule shoot"}
          onClose={() => !busy && setShowForm(false)}
          saving={busy}
        >
          <div className="space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#D4AF8C]/65">Date</label>
              <input
                type="date"
                className={cn(VA_FILTER_INPUT, "mt-1 w-full")}
                value={form.schedule_date}
                onChange={(e) => setForm((f) => ({ ...f, schedule_date: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#D4AF8C]/65">Start</label>
                <input
                  type="time"
                  className={cn(VA_FILTER_INPUT, "mt-1 w-full")}
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#D4AF8C]/65">End</label>
                <input
                  type="time"
                  className={cn(VA_FILTER_INPUT, "mt-1 w-full")}
                  value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#D4AF8C]/65">Model</label>
              <select
                className={cn(VA_FILTER_INPUT, "mt-1 w-full")}
                value={form.model_id}
                onChange={(e) => setForm((f) => ({ ...f, model_id: e.target.value }))}
              >
                <option value="">Select model…</option>
                {models.map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#D4AF8C]/65">Location</label>
              <input
                className={cn(VA_FILTER_INPUT, "mt-1 w-full")}
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Studio / address…"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[#D4AF8C]/65">Notes</label>
              <textarea
                className={cn(VA_FILTER_INPUT, "mt-1 min-h-[80px] w-full")}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Call time, wardrobe…"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className={VA_BTN_SECONDARY}
              disabled={busy}
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={VA_BTN_PRIMARY}
              disabled={busy}
              onClick={() => void saveForm()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </ReviewModalShell>
      ) : null}
    </div>
  );
}
