"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  LayoutGrid,
  List,
  Loader2,
  Minus,
  Radio,
  Search,
  Sparkles,
  Palette,
  Coffee,
  Table2,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import { BeautifulDetailModal } from "@/components/beautiful-detail-modal";
import type { AdminScheduleOverviewRow, OverviewNormStatus, OverviewRowKind } from "@/lib/admin-schedule-overview-rows";
import type { ScheduleOverviewPeriodIndicator } from "@/lib/schedule-overview-page-data";
import { ScheduleOverviewPeriodBadges } from "@/components/schedule-overview-period-badges";
import { addDays, addWeeks, formatWeekLabel, getMondayOfWeek, getThisWeekMonday, parseWeekStart, getTodayYmd } from "@/lib/weekly-program";
import { formatDateOnlyEuropean } from "@/lib/format";

type ModelOption = { id: string; name: string };

type TypeFilter = "all" | OverviewRowKind | "availability" | "schedule_other";
type StatusFilter = "all" | OverviewNormStatus;
type ViewMode = "calendar" | "list" | "timeline";

type Props = {
  initialWeek: string;
  windowStart: string;
  windowEnd: string;
  models: ModelOption[];
  rows: AdminScheduleOverviewRow[];
  /** Period snapshots per model record id from schedule overview loader. */
  periodByModelId?: Record<string, ScheduleOverviewPeriodIndicator>;
  audience?: "admin" | "va";
  /** Alias for `audience="va"`: read-only (no admin links), VA week nav, VA content actions in details. */
  readOnly?: boolean;
  /** Users / Airtable record id for the VA (passed for parity; APIs use session). */
  vaUserId?: string;
  /** Default surface for dense schedules (VA schedule overview uses timeline). */
  initialViewMode?: ViewMode;
};
type ListSortKey = "date" | "model" | "type";
type ExportFormat = "csv" | "json";

/** Brand-aligned row accent colors */
const ROW_HEX = {
  custom: "#ec4899",
  va: "#3b82f6",
  live: "#ef4444",
  availability: "#10b981",
  personal: "#f59e0b",
} as const;

function isRestAvailability(row: AdminScheduleOverviewRow): boolean {
  return row.kind === "schedule" && row.scheduleItemType === "rest";
}

function rowMatchesTypeFilter(row: AdminScheduleOverviewRow, f: TypeFilter): boolean {
  if (f === "all") return true;
  if (f === "availability") return isRestAvailability(row);
  if (f === "schedule_other") return row.kind === "schedule" && !isRestAvailability(row);
  return row.kind === f;
}

function rowHexAndStyle(row: AdminScheduleOverviewRow): { hex: string; className: string } {
  if (row.kind === "custom_request") {
    return {
      hex: ROW_HEX.custom,
      className: "border-[#ec4899]/45 bg-[#ec4899]/12 text-pink-50 shadow-[inset_0_0_0_1px_rgba(236,72,153,0.18)]",
    };
  }
  if (row.kind === "va_content") {
    return {
      hex: ROW_HEX.va,
      className: "border-[#3b82f6]/45 bg-[#3b82f6]/12 text-blue-50 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)]",
    };
  }
  if (row.kind === "live_stream") {
    return {
      hex: ROW_HEX.live,
      className: "border-[#ef4444]/45 bg-[#ef4444]/12 text-red-50 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.2)]",
    };
  }
  if (row.kind === "personal_event") {
    return {
      hex: ROW_HEX.personal,
      className: "border-amber-400/45 bg-amber-500/12 text-amber-100 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.2)]",
    };
  }
  if (isRestAvailability(row)) {
    return {
      hex: ROW_HEX.availability,
      className: "border-[#10b981]/45 bg-[#10b981]/12 text-emerald-50 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]",
    };
  }
  return { hex: "#a1a1aa", className: "border-white/15 bg-white/[0.06] text-white/85" };
}

function TypeGlyph({ row, className }: { row: AdminScheduleOverviewRow; className?: string }) {
  const Icon: LucideIcon =
    row.kind === "custom_request"
      ? Sparkles
      : row.kind === "va_content"
        ? Palette
        : row.kind === "live_stream"
          ? Radio
          : row.kind === "personal_event"
            ? CalendarDays
            : isRestAvailability(row)
              ? Coffee
              : CalendarDays;
  return <Icon className={cn("h-3.5 w-3.5 shrink-0 opacity-90", className)} aria-hidden />;
}

function escapeCsvCell(s: string): string {
  return `"${String(s ?? "").replace(/"/g, '""')}"`;
}

function initialsFromName(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? "";
    const b = parts[parts.length - 1][0] ?? "";
    return (a + b).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

function normStatusBadgeClass(s: OverviewNormStatus): string {
  if (s === "pending") return "border-amber-500/40 bg-amber-500/15 text-amber-100";
  if (s === "scheduled") return "border-sky-500/40 bg-sky-500/15 text-sky-100";
  return "border-emerald-500/40 bg-emerald-500/15 text-emerald-100";
}

function normStatusLabel(s: OverviewNormStatus): string {
  if (s === "pending") return "Pending";
  if (s === "scheduled") return "Scheduled";
  return "Completed";
}

function hashColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 62%, 48%)`;
}

function formatCalendarDayName(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

function formatCalendarDayDate(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function formatListDateHeader(date: string, todayYmd: string): string {
  const tomorrow = addDays(todayYmd, 1);
  if (date === todayYmd) return "Today";
  if (date === tomorrow) return "Tomorrow";
  return formatDateOnlyEuropean(date);
}

function TrendDelta({ current, previous }: { current: number; previous: number }) {
  const d = current - previous;
  if (d === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-white/40">
        <Minus className="h-3.5 w-3.5" />
        vs prior week
      </span>
    );
  }
  const up = d > 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px] font-medium", up ? "text-emerald-400" : "text-rose-400")}>
      {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      {up ? "+" : ""}
      {d} vs prior week
    </span>
  );
}

function headerGradientForRow(row: AdminScheduleOverviewRow): string {
  if (row.kind === "custom_request") return "from-pink-600/45 via-fuchsia-950/55 to-zinc-950";
  if (row.kind === "va_content") return "from-blue-600/45 via-slate-950/55 to-zinc-950";
  if (row.kind === "live_stream") return "from-red-600/45 via-zinc-950/55 to-zinc-950";
  if (row.kind === "personal_event") return "from-amber-600/45 via-zinc-950/55 to-zinc-950";
  if (isRestAvailability(row)) return "from-emerald-600/40 via-zinc-950/55 to-zinc-950";
  return "from-zinc-600/45 via-zinc-950/55 to-zinc-950";
}

function DetailBody({ row }: { row: AdminScheduleOverviewRow }) {
  const d = row.detail;
  if (!d) {
    return <p className="text-sm text-white/55">Details are not available for this row.</p>;
  }
  if (d.kind === "custom_request") {
    return (
      <div className="space-y-3 text-sm text-white/80">
        <DetailRow label="Fan" value={d.fanUsername || "—"} />
        <DetailRow label="Type / title" value={d.requestTitle || "—"} />
        <DetailRow label="Price" value={d.price || "—"} />
        <DetailRow label="Scheduled" value={[d.scheduledDate, d.scheduledStart, d.scheduledEnd].filter(Boolean).join(" ") || "—"} />
        <DetailRow label="Model status" value={d.modelStatus} />
        <DetailRow label="Admin status" value={d.adminStatus} />
        <DetailRow label="Chatter" value={d.chatterName} />
        {d.requestDetails ? (
          <div>
            <p className="text-xs text-white/45">Details</p>
            <p className="mt-0.5 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-2 text-white/75">{d.requestDetails}</p>
          </div>
        ) : null}
      </div>
    );
  }
  if (d.kind === "va_content") {
    return (
      <div className="space-y-3 text-sm text-white/80">
        <DetailRow label="Title" value={d.title} />
        <DetailRow label="Description" value={d.description || "—"} />
        <DetailRow label="VA" value={d.vaName} />
        <DetailRow label="Deadline" value={d.deadline ? formatDateOnlyEuropean(d.deadline.slice(0, 10)) : "—"} />
        <DetailRow label="Scheduled" value={d.scheduledDate ? formatDateOnlyEuropean(d.scheduledDate.slice(0, 10)) : "—"} />
        <DetailRow label="Status" value={d.status} />
        {d.vaNotes?.trim() ? (
          <div>
            <p className="text-xs text-white/45">VA notes</p>
            <p className="mt-0.5 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-2 text-white/75">{d.vaNotes}</p>
          </div>
        ) : null}
        {d.fileUrl ? (
          <a href={d.fileUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-sky-100 hover:bg-sky-500/25">
            Download{d.fileName ? `: ${d.fileName}` : ""}
          </a>
        ) : null}
      </div>
    );
  }
  if (d.kind === "live_stream") {
    return (
      <div className="space-y-3 text-sm text-white/80">
        <DetailRow label="Platform" value={d.platformLabel || d.platform || "—"} />
        <DetailRow label="Duration" value={d.durationMinutes != null ? `${d.durationMinutes} min` : "—"} />
        <DetailRow label="Status" value={d.status} />
        <DetailRow label="Planned" value={[d.plannedStart, d.plannedEnd].filter(Boolean).join(" → ") || "—"} />
        <DetailRow label="Actual" value={[d.actualStart, d.actualEnd].filter(Boolean).join(" → ") || "—"} />
        {d.details ? <DetailRow label="Details" value={d.details} /> : null}
      </div>
    );
  }
  if (d.kind === "personal_event") {
    return (
      <div className="space-y-3 text-sm text-white/80">
        <DetailRow label="Event type" value={d.eventType} />
        <DetailRow label="Label" value={d.eventLabel} />
        <DetailRow label="Time" value={d.eventTime || "—"} />
        <DetailRow label="Notes" value={d.notes || "—"} />
      </div>
    );
  }
  return (
    <div className="space-y-3 text-sm text-white/80">
      <DetailRow label="Item type" value={d.itemType} />
      <DetailRow label="Times" value={[d.startTime, d.endTime].filter(Boolean).join(" – ") || "—"} />
      <DetailRow label="Status" value={row.statusRaw} />
      {d.details ? (
        <div>
          <p className="text-xs text-white/45">Details</p>
          <p className="mt-0.5 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-2 text-white/75">{d.details}</p>
        </div>
      ) : null}
      {d.instructions ? (
        <div>
          <p className="text-xs text-white/45">Instructions</p>
          <p className="mt-0.5 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-2 text-white/75">{d.instructions}</p>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-0.5 text-white/85">{value}</p>
    </div>
  );
}

function VaContentScheduleActions({
  assignmentId,
  onUpdated,
}: {
  assignmentId: string;
  onUpdated: () => void;
}) {
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<"note" | "sent" | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  async function postJson(url: string, body: Record<string, string>): Promise<void> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  }

  return (
    <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-white/45">Your assignment actions</p>
      {err ? <p className="text-sm text-rose-300">{err}</p> : null}
      <label className="block">
        <span className="text-xs text-white/50">Append to VA notes</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Notes for coordinators or the model…"
          className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null || !note.trim()}
          onClick={async () => {
            setErr(null);
            setBusy("note");
            try {
              await postJson("/api/va/schedule/va-content-notes", { assignment_id: assignmentId, note: note.trim() });
              setNote("");
              onUpdated();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Failed");
            } finally {
              setBusy(null);
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-sm font-medium text-sky-100 disabled:opacity-40"
        >
          {busy === "note" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save note
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={async () => {
            setErr(null);
            setBusy("sent");
            try {
              await postJson("/api/va/schedule/va-content-sent", { assignment_id: assignmentId });
              onUpdated();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Failed");
            } finally {
              setBusy(null);
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-100 disabled:opacity-40"
        >
          {busy === "sent" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Mark sent to model
        </button>
      </div>
    </div>
  );
}

function RelatedContactCard({ row, className }: { row: AdminScheduleOverviewRow; className?: string }) {
  const d = row.detail;
  if (d.kind === "custom_request" && d.chatterName && d.chatterName !== "—") {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3", className)}>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${ROW_HEX.custom}aa, ${ROW_HEX.va}99)` }}
        >
          {initialsFromName(d.chatterName)}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-white/45">Chatter</p>
          <p className="truncate text-sm font-medium text-white">{d.chatterName}</p>
        </div>
      </div>
    );
  }
  if (d.kind === "va_content" && d.vaName && d.vaName !== "—") {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3", className)}>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${ROW_HEX.va}cc, #1d4ed8aa)` }}
        >
          {initialsFromName(d.vaName)}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-white/45">VA</p>
          <p className="truncate text-sm font-medium text-white">{d.vaName}</p>
        </div>
      </div>
    );
  }
  return null;
}

const TYPE_CHIP_OPTIONS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All types" },
  { id: "personal_event", label: "Personal" },
  { id: "custom_request", label: "Custom" },
  { id: "va_content", label: "VA" },
  { id: "live_stream", label: "Live" },
  { id: "availability", label: "Availability" },
  { id: "schedule_other", label: "Schedule" },
];

const STATUS_CHIP_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "scheduled", label: "Scheduled" },
  { id: "completed", label: "Completed" },
];

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "border-pink-500/50 bg-pink-500/25 text-pink-50 shadow-[0_0_16px_-6px_rgba(236,72,153,0.4)]"
          : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white/90"
      )}
    >
      {children}
    </motion.button>
  );
}

function ModelAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px]";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-gradient-to-br from-white/[0.1] to-pink-500/10 font-semibold text-white/90",
        sz
      )}
      aria-hidden
    >
      {initialsFromName(name)}
    </span>
  );
}

function NormStatusBadge({ status }: { status: OverviewNormStatus }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", normStatusBadgeClass(status))}>
      {normStatusLabel(status)}
    </span>
  );
}

function ModelNameBadge({ name }: { name: string }) {
  const color = hashColorFromName(name);
  return (
    <span
      className="inline-flex max-w-[120px] shrink-0 items-center truncate rounded-full border px-2 py-0.5 text-[11px] font-medium text-white/90"
      style={{
        borderColor: `${color}66`,
        backgroundColor: `${color}22`,
      }}
      title={name}
    >
      {name}
    </span>
  );
}

function ScheduleEventRow({
  row,
  onSelect,
  showModel = true,
  showDate = false,
  periodByModelId,
  isVaMode,
}: {
  row: AdminScheduleOverviewRow;
  onSelect: (row: AdminScheduleOverviewRow) => void;
  showModel?: boolean;
  showDate?: boolean;
  periodByModelId: Record<string, ScheduleOverviewPeriodIndicator>;
  isVaMode: boolean;
}) {
  const st = rowHexAndStyle(row);
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      onClick={() => onSelect(row)}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/[0.14] hover:bg-white/[0.05]"
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: st.hex }} aria-hidden />
      <TypeGlyph row={row} className="text-white/70" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {showModel ? <ModelNameBadge name={row.modelName} /> : null}
          <span className="truncate text-[13px] font-medium text-white">{row.title}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-white/50">
          {showDate ? <span>{formatDateOnlyEuropean(row.date)}</span> : null}
          {row.timeLabel ? <span className="tabular-nums">{row.timeLabel}</span> : null}
          <span>{row.typeLabel}</span>
          <ScheduleOverviewPeriodBadges summary={periodByModelId[row.modelId]} audience={isVaMode ? "va" : "admin"} />
        </div>
      </div>
      <NormStatusBadge status={row.normStatus} />
    </motion.button>
  );
}

export function AdminModelSchedulesClient({
  initialWeek,
  windowStart,
  windowEnd,
  models,
  rows,
  periodByModelId = {},
  audience = "admin",
  readOnly = false,
  initialViewMode = "calendar",
}: Props) {
  const router = useRouter();
  const isVaMode = readOnly || audience === "va";
  const weekNavBase = isVaMode ? ROUTES.va.scheduleOverview : ROUTES.admin.modelSchedulesOverview;

  const [modelFilter, setModelFilter] = React.useState<{ mode: "all" | "subset"; ids: string[] }>({ mode: "all", ids: [] });
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>(initialViewMode);
  const [timelineSearch, setTimelineSearch] = React.useState("");
  const [selected, setSelected] = React.useState<AdminScheduleOverviewRow | null>(null);
  const [listSort, setListSort] = React.useState<ListSortKey>("date");
  const [exportOpen, setExportOpen] = React.useState(false);
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>("csv");
  const [exportFrom, setExportFrom] = React.useState(windowStart);
  const [exportTo, setExportTo] = React.useState(windowEnd);
  const [exportModelIds, setExportModelIds] = React.useState<Set<string>>(() => new Set(models.map((m) => m.id)));
  const [exportTypeSet, setExportTypeSet] = React.useState<Set<TypeFilter>>(
    () => new Set(["personal_event", "custom_request", "va_content", "live_stream", "availability", "schedule_other", "schedule"] as TypeFilter[])
  );
  const [exporting, setExporting] = React.useState(false);
  const [modelsDropdownOpen, setModelsDropdownOpen] = React.useState(false);
  const modelsDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setExportFrom(windowStart);
    setExportTo(windowEnd);
  }, [windowStart, windowEnd]);

  React.useEffect(() => {
    setExportModelIds((prev) => {
      const next = new Set<string>();
      for (const m of models) {
        if (prev.has(m.id) || prev.size === 0) next.add(m.id);
      }
      return next.size ? next : new Set(models.map((m) => m.id));
    });
  }, [models]);

  React.useEffect(() => {
    if (!modelsDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (modelsDropdownRef.current && !modelsDropdownRef.current.contains(e.target as Node)) {
        setModelsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [modelsDropdownOpen]);

  const weekStart = initialWeek;
  const weekEnd = React.useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const prevWeekStart = React.useMemo(() => addWeeks(weekStart, -1), [weekStart]);
  const prevWeekEnd = React.useMemo(() => addDays(prevWeekStart, 6), [prevWeekStart]);
  const todayYmd = getTodayYmd();
  const todayInView = todayYmd >= weekStart && todayYmd <= weekEnd;

  const modelIdSet = React.useMemo(() => {
    if (modelFilter.mode === "all") return null as Set<string> | null;
    return new Set(modelFilter.ids);
  }, [modelFilter]);

  const filteredRows = React.useMemo(() => {
    return rows.filter((r) => {
      if (modelIdSet && !modelIdSet.has(r.modelId)) return false;
      if (!rowMatchesTypeFilter(r, typeFilter)) return false;
      if (statusFilter !== "all" && r.normStatus !== statusFilter) return false;
      if (viewMode === "timeline" && timelineSearch.trim()) {
        const q = timelineSearch.trim().toLowerCase();
        const blob = [r.title, r.modelName, r.typeLabel, r.statusRaw, r.csvDetails].join(" ").toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, modelIdSet, typeFilter, statusFilter, viewMode, timelineSearch]);

  const rowsThisWeek = React.useMemo(
    () => filteredRows.filter((r) => r.date >= weekStart && r.date <= weekEnd),
    [filteredRows, weekStart, weekEnd]
  );

  const rowsPrevWeekSlice = React.useMemo(
    () => filteredRows.filter((r) => r.date >= prevWeekStart && r.date <= prevWeekEnd),
    [filteredRows, prevWeekStart, prevWeekEnd]
  );

  const stats = React.useMemo(() => {
    const scheduled = rowsThisWeek.filter((r) => r.normStatus === "scheduled").length;
    const pending = rowsThisWeek.filter((r) => r.normStatus === "pending").length;
    const completed = rowsThisWeek.filter((r) => r.normStatus === "completed").length;
    const byModel = new Map<string, number>();
    for (const r of rowsThisWeek) {
      byModel.set(r.modelName, (byModel.get(r.modelName) ?? 0) + 1);
    }
    const top = [...byModel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { scheduled, pending, completed, top };
  }, [rowsThisWeek]);

  const prevStats = React.useMemo(() => {
    const scheduled = rowsPrevWeekSlice.filter((r) => r.normStatus === "scheduled").length;
    const pending = rowsPrevWeekSlice.filter((r) => r.normStatus === "pending").length;
    const completed = rowsPrevWeekSlice.filter((r) => r.normStatus === "completed").length;
    return { scheduled, pending, completed };
  }, [rowsPrevWeekSlice]);

  const activeFilterCount = React.useMemo(() => {
    let n = 0;
    if (typeFilter !== "all") n++;
    if (statusFilter !== "all") n++;
    if (modelFilter.mode === "subset") n++;
    return n;
  }, [typeFilter, statusFilter, modelFilter.mode]);

  const navigateWeek = (nextMonday: string) => {
    router.push(`${weekNavBase}?week=${encodeURIComponent(nextMonday)}`);
  };

  const scrollCalendarToToday = () => {
    if (!todayInView) return;
    const el = document.getElementById(`cal-col-${todayYmd}`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const displayModels = React.useMemo(() => {
    if (modelFilter.mode === "all") return models;
    const set = new Set(modelFilter.ids);
    return models.filter((m) => set.has(m.id));
  }, [models, modelFilter]);

  const selectedModelCount = modelFilter.mode === "subset" ? modelFilter.ids.length : models.length;

  const toggleModelCheckbox = (id: string, checked: boolean) => {
    setModelFilter((prev) => {
      if (prev.mode === "all") {
        if (!checked) {
          const ids = models.map((m) => m.id).filter((x) => x !== id);
          return ids.length === 0 ? { mode: "all", ids: [] } : { mode: "subset", ids };
        }
        return prev;
      }
      const ids = checked ? [...prev.ids, id] : prev.ids.filter((x) => x !== id);
      if (ids.length === 0) return { mode: "all", ids: [] };
      if (ids.length === models.length) return { mode: "all", ids: [] };
      return { mode: "subset", ids };
    });
  };

  const clearAllFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setModelFilter({ mode: "all", ids: [] });
  };

  const rowMatchesExportType = (r: AdminScheduleOverviewRow, set: Set<TypeFilter>): boolean => {
    if (set.size === 0) return false;
    const keys: TypeFilter[] = ["personal_event", "custom_request", "va_content", "live_stream", "availability", "schedule_other", "schedule"];
    if (keys.every((k) => set.has(k))) return true;
    if (set.has("personal_event") && r.kind === "personal_event") return true;
    if (set.has("custom_request") && r.kind === "custom_request") return true;
    if (set.has("va_content") && r.kind === "va_content") return true;
    if (set.has("live_stream") && r.kind === "live_stream") return true;
    if (set.has("availability") && isRestAvailability(r)) return true;
    if (set.has("schedule_other") && r.kind === "schedule" && !isRestAvailability(r)) return true;
    if (set.has("schedule") && r.kind === "schedule") return true;
    return false;
  };

  const runExport = () => {
    setExporting(true);
    const from = exportFrom <= exportTo ? exportFrom : exportTo;
    const to = exportFrom <= exportTo ? exportTo : exportFrom;
    window.setTimeout(() => {
      const subset = rows.filter((r) => {
        if (r.date < from || r.date > to) return false;
        if (exportModelIds.size > 0 && !exportModelIds.has(r.modelId)) return false;
        return rowMatchesExportType(r, exportTypeSet);
      });
      const stamp = weekStart;
      if (exportFormat === "csv") {
        const lines = [
          ["model", "date", "type", "status", "details"].join(","),
          ...subset.map((r) =>
            [r.modelName, r.date, r.typeLabel, r.statusRaw, r.csvDetails].map((c) => escapeCsvCell(String(c ?? ""))).join(",")
          ),
        ];
        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `schedule-overview-${stamp}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const json = JSON.stringify(subset, null, 2);
        const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `schedule-overview-${stamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setExporting(false);
      setExportOpen(false);
    }, 400);
  };

  const sortedListRows = React.useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      if (listSort === "date") {
        const c = a.date.localeCompare(b.date);
        if (c !== 0) return c;
        return (a.timeLabel ?? "").localeCompare(b.timeLabel ?? "") || a.title.localeCompare(b.title);
      }
      if (listSort === "model") {
        const c = a.modelName.localeCompare(b.modelName);
        if (c !== 0) return c;
        return a.date.localeCompare(b.date);
      }
      const c = a.typeLabel.localeCompare(b.typeLabel);
      if (c !== 0) return c;
      return a.date.localeCompare(b.date);
    });
    return copy;
  }, [filteredRows, listSort]);

  const listGroupedByDate = React.useMemo(() => {
    const map: { date: string; rows: AdminScheduleOverviewRow[] }[] = [];
    for (const r of sortedListRows) {
      const last = map[map.length - 1];
      if (last && last.date === r.date) last.rows.push(r);
      else map.push({ date: r.date, rows: [r] });
    }
    return map;
  }, [sortedListRows]);

  const toggleExportType = (id: TypeFilter) => {
    setExportTypeSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) return new Set(["personal_event", "custom_request", "va_content", "live_stream", "availability", "schedule_other", "schedule"]);
      return next;
    });
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
      {isVaMode ? (
        <div className="flex flex-col gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex w-fit items-center rounded-full border border-sky-400/40 bg-sky-500/20 px-2.5 py-0.5 text-[13px] font-semibold text-sky-100">
            VA view
          </span>
          <p className="text-[13px] text-white/75">
            Read-only agency schedule overview. Open a <span className="text-white/90">VA content</span> row to append notes or mark sent to model.
          </p>
        </div>
      ) : null}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Scheduled"
          value={stats.scheduled}
          icon={CalendarDays}
          iconClass="text-sky-300"
          iconBg="bg-sky-500/15"
          trend={<TrendDelta current={stats.scheduled} previous={prevStats.scheduled} />}
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          icon={Clock}
          iconClass="text-amber-300"
          iconBg="bg-amber-500/15"
          trend={<TrendDelta current={stats.pending} previous={prevStats.pending} />}
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={CheckCircle}
          iconClass="text-emerald-300"
          iconBg="bg-emerald-500/15"
          trend={<TrendDelta current={stats.completed} previous={prevStats.completed} />}
        />
        <motion.div
          whileHover={{ y: -2, transition: { type: "spring", stiffness: 400, damping: 24 } }}
          className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-white/55">Top models</p>
              <p className="mt-0.5 text-[13px] text-white/40">This week · by volume</p>
              {stats.top.length === 0 ? (
                <p className="mt-3 text-[13px] text-white/50">No items</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {stats.top.map(([name, n]) => (
                    <li key={name} className="flex items-center gap-2">
                      <ModelAvatar name={name} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/90">{name}</span>
                      <span className="shrink-0 rounded-full border border-pink-500/30 bg-pink-500/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-pink-100">
                        {n}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 text-pink-300">
              <Trophy className="h-5 w-5" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters bar */}
      <div className="relative z-50 space-y-4 overflow-visible rounded-xl border border-white/[0.08] bg-black/25 p-4 backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterCount > 0 ? (
              <span className="rounded-full border border-pink-500/35 bg-pink-500/15 px-2.5 py-0.5 text-[13px] font-medium text-pink-100">
                {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} active
              </span>
            ) : null}
            <button
              type="button"
              onClick={clearAllFilters}
              disabled={activeFilterCount === 0}
              className="text-[13px] font-medium text-pink-300/90 underline-offset-4 hover:text-pink-200 hover:underline disabled:opacity-40"
            >
              Clear all
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => navigateWeek(addWeeks(weekStart, -1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navigateWeek(getThisWeekMonday())}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] font-medium text-white/85 hover:bg-white/[0.08]"
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => navigateWeek(addWeeks(weekStart, 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => {
                const parsed = parseWeekStart(e.target.value);
                if (parsed) navigateWeek(getMondayOfWeek(parsed));
              }}
              className="min-h-9 rounded-xl border border-white/[0.08] bg-black/40 px-2 py-1.5 text-[13px] text-white"
            />
            <div className="text-right">
              <p className="text-[13px] font-medium text-white/80">{formatWeekLabel(weekStart)}</p>
              <p className="text-[13px] text-white/40">
                Loaded {windowStart} → {windowEnd}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[13px] font-medium text-white/50">Type</p>
          <div className="flex flex-wrap gap-2">
            {TYPE_CHIP_OPTIONS.map((opt) => (
              <FilterPill key={opt.id} active={typeFilter === opt.id} onClick={() => setTypeFilter(opt.id)}>
                {opt.label}
              </FilterPill>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[13px] font-medium text-white/50">Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_CHIP_OPTIONS.map((opt) => (
              <FilterPill key={opt.id} active={statusFilter === opt.id} onClick={() => setStatusFilter(opt.id)}>
                {opt.label}
              </FilterPill>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-visible sm:flex-row sm:items-end sm:justify-between">
          <div ref={modelsDropdownRef} className="relative overflow-visible">
            <p className="mb-2 text-[13px] font-medium text-white/50">Models</p>
            <button
              type="button"
              onClick={() => setModelsDropdownOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] font-medium text-white/85 hover:bg-white/[0.08]"
            >
              All models
              {modelFilter.mode === "subset" ? (
                <span className="rounded-full border border-pink-500/35 bg-pink-500/15 px-2 py-0.5 text-[11px] font-semibold text-pink-100">
                  {selectedModelCount} model{selectedModelCount === 1 ? "" : "s"}
                </span>
              ) : null}
              <ChevronDown className={cn("h-4 w-4 text-white/50 transition-transform", modelsDropdownOpen && "rotate-180")} />
            </button>
            {modelsDropdownOpen ? (
              <div className="absolute left-0 top-full z-[60] mt-2 min-w-[280px] max-h-56 overflow-y-auto rounded-xl border border-white/[0.1] bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-xl">
                {models.length === 0 ? (
                  <p className="px-2 py-2 text-[13px] text-white/50">No models</p>
                ) : (
                  models.map((m) => {
                    const checked = modelFilter.mode === "all" || modelFilter.ids.includes(m.id);
                    return (
                      <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-white/85 hover:bg-white/[0.06]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleModelCheckbox(m.id, e.target.checked)}
                          className="rounded border-white/25"
                        />
                        <ModelAvatar name={m.name} size="sm" />
                        <span className="whitespace-nowrap">{m.name}</span>
                      </label>
                    );
                  })
                )}
                <button
                  type="button"
                  onClick={() => setModelFilter({ mode: "all", ids: [] })}
                  className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-[13px] text-pink-300 hover:bg-pink-500/10"
                >
                  Show all models
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle mode="calendar" current={viewMode} set={setViewMode} label="Calendar" icon={LayoutGrid} />
            <ViewToggle mode="list" current={viewMode} set={setViewMode} label="List" icon={List} />
            <ViewToggle mode="timeline" current={viewMode} set={setViewMode} label="Timeline" icon={Table2} />
            {viewMode === "timeline" ? (
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                  placeholder="Search timeline…"
                  className="w-full rounded-xl border border-white/[0.08] bg-black/40 py-2.5 pl-9 pr-3 text-[13px] text-white placeholder:text-white/35"
                />
              </div>
            ) : null}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.06] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-white/[0.1]"
            >
              <Download className="h-4 w-4" />
              Export…
            </motion.button>
            {viewMode === "calendar" && todayInView ? (
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={scrollCalendarToToday}
                className="rounded-xl border border-pink-500/35 bg-pink-500/10 px-3 py-2 text-[13px] font-medium text-pink-100 hover:bg-pink-500/20"
              >
                Today
              </motion.button>
            ) : null}
          </div>
        </div>
      </div>

      {!isVaMode ? (
        <p className="text-[13px] text-white/45">
          Per-model week editor:{" "}
          <Link href={ROUTES.admin.modelSchedules} className="text-pink-300 hover:underline">
            Model schedules
          </Link>
        </p>
      ) : (
        <p className="text-[13px] text-white/45">Per-model scheduling is managed by admins (not editable in VA view).</p>
      )}

      {/* Calendar view */}
      {viewMode === "calendar" ? (
        <div className="overflow-x-auto scroll-smooth rounded-xl border border-white/[0.08] bg-black/20 backdrop-blur-xl">
          <table className="w-full min-w-[800px] border-collapse text-left">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-white/[0.08] bg-zinc-950/95 backdrop-blur-md">
                <th className="sticky left-0 z-30 min-w-[200px] border-r border-white/[0.06] bg-zinc-950/98 px-4 py-3 text-[13px] font-medium text-white/55 backdrop-blur-md">
                  Model
                </th>
                {weekDays.map((d) => {
                  const isTodayCol = d === todayYmd;
                  return (
                    <th
                      key={d}
                      id={`cal-col-${d}`}
                      className={cn(
                        "min-w-[100px] border-r border-white/[0.06] px-2 py-3 text-center last:border-r-0",
                        isTodayCol && "bg-pink-500/[0.08]"
                      )}
                    >
                      <div className={cn("text-[13px] font-medium", isTodayCol ? "text-pink-300" : "text-white/55")}>
                        {formatCalendarDayName(d)}
                      </div>
                      <div className={cn("mt-0.5 text-[13px] tabular-nums", isTodayCol ? "font-semibold text-pink-200" : "text-white/70")}>
                        {formatCalendarDayDate(d)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayModels.map((m, ri) => (
                <motion.tr
                  key={m.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: ri * 0.02 }}
                  className={cn(
                    "border-b border-white/[0.06] transition-colors hover:bg-white/[0.04]",
                    ri % 2 === 0 ? "bg-white/[0.015]" : "bg-transparent"
                  )}
                >
                  <td className="sticky left-0 z-10 max-w-[240px] border-r border-white/[0.06] bg-zinc-950/95 px-4 py-3 align-top backdrop-blur-sm">
                    <div className="flex min-w-0 items-start gap-2">
                      <ModelAvatar name={m.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-white">{m.name}</p>
                        <ScheduleOverviewPeriodBadges summary={periodByModelId[m.id]} audience={isVaMode ? "va" : "admin"} />
                      </div>
                    </div>
                  </td>
                  {weekDays.map((d) => {
                    const cell = filteredRows.filter((r) => r.modelId === m.id && r.date === d);
                    const isTodayCol = d === todayYmd;
                    const visible = cell.slice(0, 2);
                    const overflow = cell.length - visible.length;
                    return (
                      <td
                        key={d}
                        className={cn(
                          "align-top border-r border-white/[0.06] px-2 py-2 last:border-r-0",
                          isTodayCol && "bg-pink-500/[0.05]"
                        )}
                      >
                        <div className="flex min-h-[48px] flex-col gap-1">
                          {visible.map((r) => {
                            const st = rowHexAndStyle(r);
                            const tooltip = [r.title, r.typeLabel, r.timeLabel ? r.timeLabel : null, r.statusRaw].filter(Boolean).join(" · ");
                            return (
                              <button
                                key={r.id}
                                type="button"
                                title={tooltip}
                                onClick={() => setSelected(r)}
                                className="inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-left text-[11px] font-medium leading-tight text-white/90 transition hover:brightness-110"
                                style={{
                                  borderColor: `${st.hex}66`,
                                  backgroundColor: `${st.hex}22`,
                                }}
                              >
                                <TypeGlyph row={r} className="h-3 w-3" />
                                <span className="truncate">{r.title}</span>
                              </button>
                            );
                          })}
                          {overflow > 0 ? (
                            <span className="px-1 text-[11px] font-medium text-white/45">+{overflow} more</span>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* List view */}
      {viewMode === "list" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-white/55">Grouped by date</p>
            <label className="flex items-center gap-2 text-[13px] text-white/70">
              <span className="text-white/45">Sort</span>
              <select
                value={listSort}
                onChange={(e) => setListSort(e.target.value as ListSortKey)}
                className="rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2 text-[13px] text-white"
              >
                <option value="date">Date</option>
                <option value="model">Model</option>
                <option value="type">Type</option>
              </select>
            </label>
          </div>
          <AnimatePresence mode="popLayout">
            {listGroupedByDate.length === 0 ? (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-white/[0.08] bg-black/20 py-12 text-center text-[13px] text-white/50"
              >
                No rows match filters.
              </motion.p>
            ) : (
              listGroupedByDate.map((g, gi) => (
                <motion.section
                  key={g.date}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.04 }}
                  className="space-y-2"
                >
                  <div className="flex items-baseline gap-2 px-1">
                    <h3 className="text-[13px] font-semibold text-white">{formatListDateHeader(g.date, todayYmd)}</h3>
                    {g.date !== todayYmd && g.date !== addDays(todayYmd, 1) ? (
                      <span className="text-[13px] text-white/40">{formatCalendarDayName(g.date)}</span>
                    ) : null}
                    <span className="text-[13px] text-white/40">
                      · {g.rows.length} item{g.rows.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {g.rows.map((r) => (
                      <ScheduleEventRow
                        key={r.id}
                        row={r}
                        onSelect={setSelected}
                        showModel
                        periodByModelId={periodByModelId}
                        isVaMode={isVaMode}
                      />
                    ))}
                  </div>
                </motion.section>
              ))
            )}
          </AnimatePresence>
        </div>
      ) : null}

      {/* Timeline view */}
      {viewMode === "timeline" ? (
        <div className="space-y-4">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
            <input
              value={timelineSearch}
              onChange={(e) => setTimelineSearch(e.target.value)}
              placeholder="Search by model, title, type, or status…"
              className="w-full rounded-xl border border-white/[0.08] bg-black/40 py-3 pl-10 pr-4 text-[13px] text-white placeholder:text-white/35"
            />
          </div>
          {filteredRows.length === 0 ? (
            <p className="rounded-xl border border-white/[0.08] bg-black/20 py-12 text-center text-[13px] text-white/50">No rows match filters.</p>
          ) : (
            <div className="space-y-2">
              {filteredRows.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <ScheduleEventRow
                    row={r}
                    onSelect={setSelected}
                    showModel
                    showDate
                    periodByModelId={periodByModelId}
                    isVaMode={isVaMode}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <BeautifulDetailModal
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.title ?? "Schedule item"}
        subtitle={
          selected
            ? `${selected.modelName} · ${formatDateOnlyEuropean(selected.date)}${selected.timeLabel ? ` · ${selected.timeLabel}` : ""}`
            : undefined
        }
        badge={selected ? `${selected.typeLabel} · ${selected.normStatus}` : undefined}
        headerGradientClass={selected ? headerGradientForRow(selected) : undefined}
        footer={
          selected && isVaMode && selected.kind === "va_content" && selected.id.startsWith("va:")
            ? (
              <VaContentScheduleActions
                assignmentId={selected.id.slice(3)}
                onUpdated={() => router.refresh()}
              />
            )
            : undefined
        }
      >
        {selected ? (
          <>
            <RelatedContactCard row={selected} className="mt-0" />
            <div className="mt-4">
              <DetailBody row={selected} />
            </div>
          </>
        ) : null}
      </BeautifulDetailModal>

      <Dialog.Root open={exportOpen} onOpenChange={setExportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[201] flex max-h-[min(90vh,640px)] w-[min(calc(100vw-2rem),420px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <Dialog.Title className="text-lg font-semibold text-white">Export schedules</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-white/50">
                Pick a window, models, and types. Download CSV or JSON.
              </Dialog.Description>
            </div>
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-white/50">
                  From
                  <input
                    type="date"
                    value={exportFrom}
                    onChange={(e) => setExportFrom(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-white/50">
                  To
                  <input
                    type="date"
                    value={exportTo}
                    onChange={(e) => setExportTo(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                  />
                </label>
              </div>
              <div>
                <p className="text-xs font-medium text-white/55">Models</p>
                <div className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-xl border border-white/12 bg-black/30 p-2">
                  {models.map((m) => (
                    <label key={m.id} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm text-white/85">
                      <input
                        type="checkbox"
                        checked={exportModelIds.has(m.id)}
                        onChange={(e) => {
                          setExportModelIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(m.id);
                            else next.delete(m.id);
                            return next.size ? next : new Set(models.map((x) => x.id));
                          });
                        }}
                      />
                      <span className="truncate">{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-white/55">Types</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      ["personal_event", "Personal"],
                      ["custom_request", "Custom"],
                      ["va_content", "VA"],
                      ["live_stream", "Live"],
                      ["availability", "Availability"],
                      ["schedule_other", "Other sched."],
                      ["schedule", "All schedule rows"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleExportType(id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        exportTypeSet.has(id)
                          ? "border-pink-400/45 bg-pink-500/15 text-pink-100"
                          : "border-white/12 bg-white/5 text-white/55"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-white/55">Format</p>
                <div className="mt-2 flex gap-2">
                  {(["csv", "json"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setExportFormat(f)}
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2 text-sm font-medium uppercase",
                        exportFormat === f
                          ? "border-white/35 bg-white/15 text-white"
                          : "border-white/10 bg-black/30 text-white/55"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
              <Dialog.Close asChild>
                <button type="button" className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10">
                  Cancel
                </button>
              </Dialog.Close>
              <motion.button
                type="button"
                disabled={exporting || exportModelIds.size === 0}
                whileTap={{ scale: 0.98 }}
                onClick={runExport}
                className="inline-flex items-center gap-2 rounded-xl border border-pink-500/35 bg-pink-500/20 px-4 py-2 text-sm font-medium text-pink-50 disabled:opacity-40"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export
              </motion.button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
  iconBg,
  trend,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  iconClass: string;
  iconBg: string;
  trend: React.ReactNode;
}) {
  return (
    <motion.div
      whileHover={{ y: -2, transition: { type: "spring", stiffness: 400, damping: 24 } }}
      className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-white/55">{label}</p>
          <p className="mt-2 text-[32px] font-bold leading-none tabular-nums text-white">{value}</p>
          <div className="mt-2 min-h-[18px]">{trend}</div>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconBg, iconClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}

function ViewToggle({
  mode,
  current,
  set,
  label,
  icon: Icon,
}: {
  mode: ViewMode;
  current: ViewMode;
  set: (m: ViewMode) => void;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const on = current === mode;
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => set(mode)}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium",
        on
          ? "border-pink-500/40 bg-pink-500/15 text-pink-100 shadow-[0_0_16px_-8px_rgba(236,72,153,0.35)]"
          : "border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08]"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </motion.button>
  );
}
