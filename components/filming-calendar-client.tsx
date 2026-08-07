"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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
  const [weekStart, setWeekStart] = React.useState(() => mondayOf(new Date()));
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<FilmingScheduleEntry | null>(null);
  const [form, setForm] = React.useState({
    schedule_date: ymd(new Date()),
    start_time: "10:00",
    end_time: "14:00",
    model_id: "",
    location: "",
    notes: "",
  });

  React.useEffect(() => setEntries(initialEntries), [initialEntries]);

  const weekEnd = addDays(weekStart, 6);
  const from = ymd(weekStart);
  const to = ymd(weekEnd);

  async function reload(range?: { from: string; to: string }) {
    setLoading(true);
    try {
      const f = range?.from ?? from;
      const t = range?.to ?? to;
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
    void reload({ from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const byDate = React.useMemo(() => {
    const map = new Map<string, FilmingScheduleEntry[]>();
    for (const e of entries) {
      const list = map.get(e.schedule_date) ?? [];
      list.push(e);
      map.set(e.schedule_date, list);
    }
    return map;
  }, [entries]);

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

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-6 py-8">
        <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-[#D4AF8C]/10 blur-3xl" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/70">Filming</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Filming Calendar</h1>
        <p className="mt-2 max-w-xl text-sm text-[#B8B4B8]/70">
          {canManage
            ? "Schedule shoots for models — they appear on the model schedule automatically."
            : "Read-only view of upcoming filming shoots."}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={VA_BTN_SECONDARY}
            onClick={() => setWeekStart((w) => addDays(w, -7))}
          >
            Previous
          </button>
          <button
            type="button"
            className={VA_BTN_SECONDARY}
            onClick={() => setWeekStart(mondayOf(new Date()))}
          >
            This week
          </button>
          <button
            type="button"
            className={VA_BTN_SECONDARY}
            onClick={() => setWeekStart((w) => addDays(w, 7))}
          >
            Next
          </button>
          {canManage ? (
            <button
              type="button"
              className={cn(VA_BTN_PRIMARY, "ml-auto inline-flex items-center gap-1.5")}
              onClick={() => openCreate()}
            >
              <Plus className="h-4 w-4" /> Add shoot
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#FF1493]" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((d, i) => {
            const key = ymd(d);
            const dayEntries = byDate.get(key) ?? [];
            return (
              <div key={key} className={cn(VA_CARD, "min-h-[140px] p-3")}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF8C]/60">
                      {DAY_LABELS[i]}
                    </p>
                    <p className="text-sm font-semibold text-white">{d.getDate()}</p>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      className="rounded-lg p-1 text-[#D4AF8C]/50 hover:bg-white/5 hover:text-[#D4AF8C]"
                      onClick={() => openCreate(key)}
                      aria-label="Add shoot"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <ul className="mt-2 space-y-2">
                  {dayEntries.map((e) => (
                    <li
                      key={e.id}
                      className="rounded-lg border border-[#FF1493]/20 bg-[#FF1493]/[0.07] p-2"
                    >
                      <p className="text-xs font-semibold text-white">{e.model_name || "Model"}</p>
                      {(e.start_time || e.end_time) && (
                        <p className="mt-0.5 text-[10px] text-[#B8B4B8]/60">
                          {[e.start_time, e.end_time].filter(Boolean).join(" – ")}
                        </p>
                      )}
                      {e.location ? (
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#D4AF8C]/70">
                          <MapPin className="h-3 w-3" /> {e.location}
                        </p>
                      ) : null}
                      {canManage ? (
                        <div className="mt-1.5 flex gap-1">
                          <button
                            type="button"
                            className="rounded p-1 text-[#B8B4B8]/50 hover:text-white"
                            onClick={() => openEdit(e)}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-[#B8B4B8]/50 hover:text-red-300"
                            onClick={() => void removeEntry(e.id)}
                            disabled={busy}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                  {dayEntries.length === 0 ? (
                    <p className="pt-4 text-center text-[10px] text-[#B8B4B8]/25">—</p>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {showForm && canManage ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(VA_CARD, VA_CARD_GLOW, "w-full max-w-md p-5")}
          >
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[#D4AF8C]" />
              <h2 className="text-lg font-semibold text-white">
                {editing ? "Edit shoot" : "Schedule shoot"}
              </h2>
            </div>
            <div className="mt-4 space-y-3">
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
              <button type="button" className={VA_BTN_SECONDARY} onClick={() => setShowForm(false)}>
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
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
