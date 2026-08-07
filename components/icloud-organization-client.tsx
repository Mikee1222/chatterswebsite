"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Cloud,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  Inbox,
  Layers,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { ContentPipelineHero } from "@/components/content-pipeline-ui";
import {
  FilterBar,
  FilterChip,
  ReviewEmptyState,
} from "@/components/manager-review-ui";
import {
  CountUp,
  InflowwCustomDateRange,
  LuxuryStatCard,
  StatInfoTooltip,
} from "@/components/infloww-performance-ui";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CARD_GLOW,
  VA_FILTER_INPUT,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import {
  daysUntilMaterialDate,
  formatDaysRemaining,
  formatMaterialDate,
  ICLOUD_STATUS_STYLES,
  MATERIAL_RUNWAY_LABELS,
  MATERIAL_RUNWAY_STYLES,
  materialRunwayTier,
  type IcloudStatus,
  type MaterialRunwayTier,
} from "@/lib/icloud-helpers";
import type {
  IcloudBunchWork,
  IcloudFolderEntry,
  IcloudFolderWithBunch,
  IcloudModelCoverage,
} from "@/services/icloud";
import { cn } from "@/lib/utils";

type ViewMode = "model" | "bunch";
type DateField = "material_until" | "submission";
type RunwayFilter = "all" | MaterialRunwayTier;

const RUNWAY_FILTERS: Array<{ value: RunwayFilter; label: string }> = [
  { value: "all", label: "All runway" },
  { value: "healthy", label: "Healthy" },
  { value: "low", label: "Low" },
  { value: "urgent", label: "Urgent" },
  { value: "none", label: "No coverage" },
];

const MATERIAL_UNTIL_TIP =
  "Material until is the last calendar day this iCloud folder’s content is expected to cover for the model. Furthest coverage uses the latest date across all folders.";

function ymdFromIso(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function coverageHeroLine(furthest: string | null, days: number | null): string {
  if (!furthest) return "No coverage date yet";
  return `Covered through ${formatMaterialDate(furthest)} · ${formatDaysRemaining(days)}`;
}

function FolderDraftForm({
  bunchId,
  busy,
  draft,
  extras,
  onDraftChange,
  onExtrasChange,
  onAddRow,
  onSave,
  onComplete,
  canComplete,
}: {
  bunchId: string;
  busy: boolean;
  draft: { label: string; link: string; until: string };
  extras: Array<{ label: string; link: string; until: string }>;
  onDraftChange: (next: { label: string; link: string; until: string }) => void;
  onExtrasChange: (next: Array<{ label: string; link: string; until: string }>) => void;
  onAddRow: () => void;
  onSave: () => void;
  onComplete: () => void;
  canComplete: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-white">Add folders</p>
      <p className="text-xs text-[#B8B4B8]/45">
        Label · link · material until — add multiple rows before saving.
      </p>
      <div className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            className={VA_FILTER_INPUT}
            placeholder="Label (required)"
            value={draft.label}
            onChange={(e) => onDraftChange({ ...draft, label: e.target.value })}
          />
          <input
            className={VA_FILTER_INPUT}
            placeholder="Link (optional)"
            value={draft.link}
            onChange={(e) => onDraftChange({ ...draft, link: e.target.value })}
          />
          <input
            type="date"
            className={VA_FILTER_INPUT}
            value={draft.until}
            onChange={(e) => onDraftChange({ ...draft, until: e.target.value })}
          />
        </div>
        {extras.map((row, idx) => (
          <div key={`${bunchId}-extra-${idx}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <input
              className={VA_FILTER_INPUT}
              placeholder="Label"
              value={row.label}
              onChange={(e) => {
                const next = [...extras];
                next[idx] = { ...next[idx]!, label: e.target.value };
                onExtrasChange(next);
              }}
            />
            <input
              className={VA_FILTER_INPUT}
              placeholder="Link"
              value={row.link}
              onChange={(e) => {
                const next = [...extras];
                next[idx] = { ...next[idx]!, link: e.target.value };
                onExtrasChange(next);
              }}
            />
            <input
              type="date"
              className={VA_FILTER_INPUT}
              value={row.until}
              onChange={(e) => {
                const next = [...extras];
                next[idx] = { ...next[idx]!, until: e.target.value };
                onExtrasChange(next);
              }}
            />
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "px-2 py-1")}
              onClick={() => onExtrasChange(extras.filter((_, i) => i !== idx))}
              aria-label="Remove row"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5")}
          onClick={onAddRow}
        >
          <Plus className="h-4 w-4" /> Add another folder
        </button>
        <button
          type="button"
          className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5")}
          disabled={busy}
          onClick={onSave}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
          Save folders
        </button>
        <button
          type="button"
          className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-1.5")}
          disabled={busy || !canComplete}
          onClick={onComplete}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Mark iCloud complete
        </button>
      </div>
    </div>
  );
}

function FolderRow({
  folder,
  showBunch,
  canRemove,
  busy,
  onRemove,
}: {
  folder: IcloudFolderWithBunch | (IcloudFolderEntry & { bunch_name?: string });
  showBunch?: boolean;
  canRemove?: boolean;
  busy?: boolean;
  onRemove?: () => void;
}) {
  const days = daysUntilMaterialDate(folder.material_until_date);
  const tier = materialRunwayTier(days);
  return (
    <li className="rounded-xl border border-white/[0.06] bg-[#0A0A0A]/60 px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <FolderOpen className="h-4 w-4 shrink-0 text-[#D4AF8C]/70" />
            <span className="text-sm font-medium text-white">{folder.folder_label}</span>
            {folder.folder_link ? (
              <a
                href={folder.folder_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[#FF1493] hover:underline"
              >
                Open <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#B8B4B8]/55">
            <span className="inline-flex items-center gap-1">
              Until {formatMaterialDate(folder.material_until_date)}
              {folder.material_until_date ? (
                <span className={cn(VA_STATUS_BADGE, "scale-90", MATERIAL_RUNWAY_STYLES[tier])}>
                  {MATERIAL_RUNWAY_LABELS[tier]}
                </span>
              ) : null}
            </span>
            {showBunch && "bunch_name" in folder && folder.bunch_name ? (
              <span>Bunch: {folder.bunch_name}</span>
            ) : null}
            <span>By {folder.created_by_name || "—"}</span>
            <span>{formatMaterialDate(ymdFromIso(folder.created_at))}</span>
          </div>
        </div>
        {canRemove && onRemove ? (
          <button
            type="button"
            className={cn(VA_BTN_SECONDARY, "px-2 py-1 text-xs")}
            disabled={busy}
            onClick={onRemove}
            aria-label="Remove folder"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function IcloudOrganizationClient({
  initialWork,
  initialModels,
  initialNeedsOrganization,
  canOrganize = true,
}: {
  initialWork: IcloudBunchWork[];
  initialModels: IcloudModelCoverage[];
  initialNeedsOrganization: IcloudBunchWork[];
  canOrganize?: boolean;
}) {
  const { addToast } = useToast();
  const [work, setWork] = React.useState(initialWork);
  const [models, setModels] = React.useState(initialModels);
  const [needsOrganization, setNeedsOrganization] = React.useState(initialNeedsOrganization);
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>("model");
  const [expandedBunchId, setExpandedBunchId] = React.useState<string | null>(
    initialNeedsOrganization[0]?.bunch.id ?? null,
  );
  const [expandedModelId, setExpandedModelId] = React.useState<string | null>(
    initialModels[0]?.model_id ?? null,
  );
  const [drafts, setDrafts] = React.useState<
    Record<string, { label: string; link: string; until: string }>
  >({});
  const [folderRows, setFolderRows] = React.useState<
    Record<string, Array<{ label: string; link: string; until: string }>>
  >({});
  const [search, setSearch] = React.useState("");
  const [modelFilter, setModelFilter] = React.useState("all");
  const [runwayFilter, setRunwayFilter] = React.useState<RunwayFilter>("all");
  const [dateField, setDateField] = React.useState<DateField>("material_until");
  const todayYmd = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const monthAgoYmd = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const [dateStart, setDateStart] = React.useState(monthAgoYmd);
  const [dateEnd, setDateEnd] = React.useState(todayYmd);
  const [dateApplied, setDateApplied] = React.useState<{ start: string; end: string } | null>(null);

  React.useEffect(() => {
    setWork(initialWork);
    setModels(initialModels);
    setNeedsOrganization(initialNeedsOrganization);
  }, [initialWork, initialModels, initialNeedsOrganization]);

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch("/api/icloud/work", { credentials: "include" });
      const data = (await res.json()) as {
        work?: IcloudBunchWork[];
        models?: IcloudModelCoverage[];
        needsOrganization?: IcloudBunchWork[];
        error?: string;
      };
      if (res.ok) {
        setWork(data.work ?? []);
        setModels(data.models ?? []);
        setNeedsOrganization(data.needsOrganization ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;
  useSupabaseRealtimeRefresh(
    ["video_bunches", "icloud_folder_entries"],
    () => void reloadRef.current(),
    { debounceMs: 700 },
  );

  function draftFor(bunchId: string) {
    return drafts[bunchId] ?? { label: "", link: "", until: "" };
  }

  function extraRows(bunchId: string) {
    return folderRows[bunchId] ?? [];
  }

  async function addFolder(
    bunchId: string,
    entry: { label: string; link: string; until: string },
  ) {
    if (!entry.label.trim()) {
      addToast(
        winnerVideoLocalToast(`icloud-val-${Date.now()}`, "Label required", "Enter a folder label.", "high"),
      );
      return false;
    }
    setBusyId(bunchId);
    try {
      const res = await fetch("/api/icloud/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bunch_id: bunchId,
          folder_label: entry.label,
          folder_link: entry.link,
          material_until_date: entry.until || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(`icloud-err-${Date.now()}`, "Failed", data.error ?? "Could not add folder", "high"),
        );
        return false;
      }
      return true;
    } finally {
      setBusyId(null);
    }
  }

  async function addAllFolders(bunchId: string) {
    const primary = draftFor(bunchId);
    const extras = extraRows(bunchId);
    const all = [primary, ...extras].filter((r) => r.label.trim() || r.link.trim() || r.until);
    if (all.length === 0 || !all.some((r) => r.label.trim())) {
      addToast(
        winnerVideoLocalToast(
          `icloud-val-${Date.now()}`,
          "Label required",
          "Add at least one folder with a label.",
          "high",
        ),
      );
      return;
    }
    let ok = 0;
    for (const row of all) {
      if (!row.label.trim()) continue;
      const success = await addFolder(bunchId, row);
      if (success) ok += 1;
    }
    if (ok > 0) {
      setDrafts((p) => ({ ...p, [bunchId]: { label: "", link: "", until: "" } }));
      setFolderRows((p) => ({ ...p, [bunchId]: [] }));
      await reload();
      addToast(
        winnerVideoLocalToast(
          `icloud-ok-${Date.now()}`,
          "Folders added",
          `${ok} folder${ok === 1 ? "" : "s"} saved.`,
          "normal",
        ),
      );
    }
  }

  async function removeFolder(entry: IcloudFolderEntry) {
    setBusyId(entry.id);
    try {
      const res = await fetch(`/api/icloud/folders/${encodeURIComponent(entry.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(`icloud-del-${Date.now()}`, "Failed", data.error ?? "Could not delete", "high"),
        );
        return;
      }
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function markComplete(bunchId: string) {
    setBusyId(bunchId);
    try {
      const res = await fetch(`/api/icloud/bunches/${encodeURIComponent(bunchId)}/complete`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(
            `icloud-done-err-${Date.now()}`,
            "Failed",
            data.error ?? "Could not complete",
            "high",
          ),
        );
        return;
      }
      addToast(
        winnerVideoLocalToast(
          `icloud-done-ok-${Date.now()}`,
          "Organized",
          "iCloud organization complete — admins notified.",
          "normal",
        ),
      );
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  const modelOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const m of models) map.set(m.model_id, m.model_name);
    for (const w of work) {
      if (w.bunch.model_id) map.set(w.bunch.model_id, w.bunch.model_name || w.bunch.model_id);
    }
    return Array.from(map.entries())
      .map(([model_id, model_name]) => ({ model_id, model_name }))
      .sort((a, b) => a.model_name.localeCompare(b.model_name));
  }, [models, work]);

  const folderMatchesSearch = React.useCallback(
    (folder: { folder_label: string }, q: string) => {
      if (!q) return true;
      return folder.folder_label.toLowerCase().includes(q);
    },
    [],
  );

  const inDateRange = React.useCallback(
    (folder: IcloudFolderEntry) => {
      if (!dateApplied) return true;
      const ymd =
        dateField === "material_until"
          ? folder.material_until_date
          : ymdFromIso(folder.created_at);
      if (!ymd) return false;
      return ymd >= dateApplied.start && ymd <= dateApplied.end;
    },
    [dateApplied, dateField],
  );

  const filteredModels = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return models
      .map((m) => {
        if (modelFilter !== "all" && m.model_id !== modelFilter) return null;
        if (runwayFilter !== "all" && m.runway !== runwayFilter) return null;
        const folders = m.folders.filter(
          (f) => folderMatchesSearch(f, q) && inDateRange(f),
        );
        if (q && folders.length === 0 && !m.model_name.toLowerCase().includes(q)) {
          return null;
        }
        if (dateApplied && folders.length === 0 && m.folders.length > 0) return null;
        if (dateApplied && m.folders.length === 0) return null;
        return { ...m, folders };
      })
      .filter(Boolean) as IcloudModelCoverage[];
  }, [models, modelFilter, runwayFilter, search, folderMatchesSearch, inDateRange, dateApplied]);

  const filteredNeeds = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return needsOrganization.filter((w) => {
      if (modelFilter !== "all" && w.bunch.model_id !== modelFilter) return false;
      if (runwayFilter !== "all") {
        const days = daysUntilMaterialDate(w.furthest_material_until);
        if (materialRunwayTier(days) !== runwayFilter) return false;
      }
      if (dateApplied) {
        const folders = w.folders.filter(inDateRange);
        if (w.folders.length > 0 && folders.length === 0) return false;
        if (w.folders.length === 0) {
          const ymd = ymdFromIso(w.bunch.edited_uploaded_at || w.bunch.updated_at);
          if (!ymd || ymd < dateApplied.start || ymd > dateApplied.end) return false;
        }
      }
      if (!q) return true;
      const hay = [w.bunch.name, w.bunch.model_name, ...w.folders.map((f) => f.folder_label)]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [needsOrganization, modelFilter, runwayFilter, search, dateApplied, inDateRange]);

  const filteredWork = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return work.filter((w) => {
      if (modelFilter !== "all" && w.bunch.model_id !== modelFilter) return false;
      if (runwayFilter !== "all") {
        const days = daysUntilMaterialDate(w.furthest_material_until);
        if (materialRunwayTier(days) !== runwayFilter) return false;
      }
      if (dateApplied) {
        const folders = w.folders.filter(inDateRange);
        if (w.folders.length > 0 && folders.length === 0) return false;
      }
      if (!q) return true;
      const hay = [w.bunch.name, w.bunch.model_name, ...w.folders.map((f) => f.folder_label)]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [work, modelFilter, runwayFilter, search, dateApplied, inDateRange]);

  const urgentModels = models.filter((m) => m.runway === "urgent").length;
  const lowModels = models.filter((m) => m.runway === "low").length;
  const noCoverage = models.filter((m) => m.runway === "none").length;
  const totalFolders = models.reduce((n, m) => n + m.folders.length, 0);

  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (modelFilter !== "all") {
    activeChips.push({
      key: "model",
      label: `Model: ${modelOptions.find((m) => m.model_id === modelFilter)?.model_name ?? modelFilter}`,
      clear: () => setModelFilter("all"),
    });
  }
  if (runwayFilter !== "all") {
    activeChips.push({
      key: "runway",
      label: `Runway: ${MATERIAL_RUNWAY_LABELS[runwayFilter]}`,
      clear: () => setRunwayFilter("all"),
    });
  }
  if (dateApplied) {
    activeChips.push({
      key: "date",
      label: `${dateField === "material_until" ? "Until" : "Submitted"} ${dateApplied.start} → ${dateApplied.end}`,
      clear: () => {
        setDateApplied(null);
        setDateStart(monthAgoYmd);
        setDateEnd(todayYmd);
      },
    });
  }
  if (search.trim()) {
    activeChips.push({
      key: "search",
      label: `Search: ${search.trim()}`,
      clear: () => setSearch(""),
    });
  }

  function renderOrganizePanel(w: IcloudBunchWork) {
    const isDone = w.bunch.icloud_status === "organized";
    const d = draftFor(w.bunch.id);
    const extras = extraRows(w.bunch.id);
    return (
      <div className="space-y-4 border-t border-white/[0.06] px-4 py-4 sm:px-5">
        <ul className="space-y-2">
          {w.folders.map((f) => (
            <FolderRow
              key={f.id}
              folder={f}
              canRemove={canOrganize && !isDone}
              busy={busyId === f.id}
              onRemove={() => void removeFolder(f)}
            />
          ))}
          {w.folders.length === 0 ? (
            <li className="text-xs text-[#B8B4B8]/45">No folders yet — add below.</li>
          ) : null}
        </ul>
        {canOrganize && !isDone ? (
          <FolderDraftForm
            bunchId={w.bunch.id}
            busy={busyId === w.bunch.id}
            draft={d}
            extras={extras}
            onDraftChange={(next) => setDrafts((p) => ({ ...p, [w.bunch.id]: next }))}
            onExtrasChange={(next) => setFolderRows((p) => ({ ...p, [w.bunch.id]: next }))}
            onAddRow={() =>
              setFolderRows((p) => ({
                ...p,
                [w.bunch.id]: [...(p[w.bunch.id] ?? []), { label: "", link: "", until: "" }],
              }))
            }
            onSave={() => void addAllFolders(w.bunch.id)}
            onComplete={() => void markComplete(w.bunch.id)}
            canComplete={w.folders.length > 0}
          />
        ) : isDone ? (
          <p className="flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Organization complete
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ContentPipelineHero
        eyebrow="iCloud"
        title="iCloud Management"
        description="Model coverage & material runway · folder inventory · outstanding organization queue"
        orb="both"
        actions={
          <button
            type="button"
            className={VA_BTN_SECONDARY}
            onClick={() => void reload()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </button>
        }
        stats={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <LuxuryStatCard
              label="Needs organization"
              value={<CountUp value={needsOrganization.length} />}
              accent={needsOrganization.length > 0 ? "pink" : "emerald"}
              glow={needsOrganization.length > 0}
              tooltip="Bunches with editing uploaded that still need iCloud folders submitted"
            />
            <LuxuryStatCard
              label="Urgent / low"
              value={<CountUp value={urgentModels + lowModels} />}
              accent={urgentModels + lowModels > 0 ? "amber" : "white"}
              glow={urgentModels > 0}
              tooltip="Models with ≤14 days of material coverage remaining (or expired)"
            />
            <LuxuryStatCard
              label="No coverage"
              value={<CountUp value={noCoverage} />}
              accent={noCoverage > 0 ? "amber" : "champagne"}
              tooltip="Models with no material-until date on any folder"
            />
            <LuxuryStatCard
              label="Folders tracked"
              value={<CountUp value={totalFolders} />}
              accent="champagne"
              tooltip="Total iCloud folder entries across all models"
            />
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition",
            viewMode === "model"
              ? "border-[#FF1493]/40 bg-[#FF1493]/15 text-white"
              : "border-white/10 bg-white/5 text-[#B8B4B8]/80 hover:border-white/20",
          )}
          onClick={() => setViewMode("model")}
        >
          <Users className="h-4 w-4" /> By model
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition",
            viewMode === "bunch"
              ? "border-[#FF1493]/40 bg-[#FF1493]/15 text-white"
              : "border-white/10 bg-white/5 text-[#B8B4B8]/80 hover:border-white/20",
          )}
          onClick={() => setViewMode("bunch")}
        >
          <Layers className="h-4 w-4" /> By bunch
        </button>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-[#B8B4B8]/50">
          Material until <StatInfoTooltip text={MATERIAL_UNTIL_TIP} />
        </span>
      </div>

      <FilterBar className={cn(VA_CARD, VA_CARD_GLOW, "space-y-3 p-4")}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B8B4B8]/35" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search folder labels, models, bunches…"
              className={cn(VA_FILTER_INPUT, "w-full pl-9")}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className={cn(VA_FILTER_INPUT, "min-w-[8rem]")}
            >
              <option value="all">All models</option>
              {modelOptions.map((m) => (
                <option key={m.model_id} value={m.model_id}>
                  {m.model_name}
                </option>
              ))}
            </select>
            <select
              value={runwayFilter}
              onChange={(e) => setRunwayFilter(e.target.value as RunwayFilter)}
              className={cn(VA_FILTER_INPUT, "min-w-[8rem]")}
            >
              {RUNWAY_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value as DateField)}
              className={cn(VA_FILTER_INPUT, "min-w-[9rem]")}
            >
              <option value="material_until">Date: material until</option>
              <option value="submission">Date: submission</option>
            </select>
          </div>
        </div>
        <InflowwCustomDateRange
          startYmd={dateStart}
          endYmd={dateEnd}
          onChange={(start, end) => {
            setDateStart(start);
            setDateEnd(end);
          }}
          onApply={(start, end) => {
            setDateStart(start);
            setDateEnd(end);
            setDateApplied({ start, end });
          }}
        />
        {activeChips.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activeChips.map((c) => (
              <FilterChip key={c.key} label={c.label} onRemove={c.clear} />
            ))}
          </div>
        ) : null}
      </FilterBar>

      {/* Needs Organization queue */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Inbox className="h-4 w-4 text-[#FF1493]" />
          <h2 className="text-sm font-semibold text-white">Needs organization</h2>
          <span
            className={cn(
              VA_STATUS_BADGE,
              needsOrganization.length > 0
                ? "bg-[#FF1493]/15 text-[#FF1493]"
                : "bg-emerald-500/15 text-emerald-300",
            )}
          >
            {filteredNeeds.length}
            {filteredNeeds.length !== needsOrganization.length
              ? ` of ${needsOrganization.length}`
              : ""}
          </span>
          <p className="w-full text-xs text-[#B8B4B8]/50 sm:w-auto sm:ml-1">
            Editing done · iCloud folders not submitted yet
          </p>
        </div>
        {filteredNeeds.length === 0 ? (
          <ReviewEmptyState
            icon={CheckCircle2}
            title={
              needsOrganization.length === 0
                ? "Queue clear"
                : "No matches in the organization queue"
            }
            description={
              needsOrganization.length === 0
                ? "Every edited bunch has its iCloud folders submitted — nice."
                : "Try clearing filters to see outstanding bunches."
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredNeeds.map((w) => {
              const open = expandedBunchId === w.bunch.id;
              const st = ICLOUD_STATUS_STYLES[w.bunch.icloud_status] ?? ICLOUD_STATUS_STYLES.pending;
              const days = daysUntilMaterialDate(w.furthest_material_until);
              const tier = materialRunwayTier(days);
              return (
                <motion.div
                  key={w.bunch.id}
                  layout
                  className={cn(VA_CARD, VA_CARD_GLOW, "overflow-hidden border border-[#FF1493]/15")}
                >
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left sm:px-5"
                    onClick={() => setExpandedBunchId(open ? null : w.bunch.id)}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-white sm:text-lg">
                          {w.bunch.name}
                        </h3>
                        <span className={cn(VA_STATUS_BADGE, st.className)}>{st.label}</span>
                        <span className={cn(VA_STATUS_BADGE, MATERIAL_RUNWAY_STYLES[tier])}>
                          {MATERIAL_RUNWAY_LABELS[tier]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[#D4AF8C]/80">
                        {w.bunch.model_name || "—"}
                      </p>
                      <p className="mt-1 text-xs text-[#B8B4B8]/50">
                        {w.folders.length} folder{w.folders.length === 1 ? "" : "s"} draft
                        {w.bunch.edited_uploaded_at
                          ? ` · edited ${formatMaterialDate(ymdFromIso(w.bunch.edited_uploaded_at))}`
                          : ""}
                      </p>
                      {w.bunch.edited_upload_folder_link ? (
                        <a
                          href={w.bunch.edited_upload_folder_link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#FF1493]/90 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Edited folder <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                    <ChevronDown
                      className={cn(
                        "mt-1 h-5 w-5 shrink-0 text-[#D4AF8C]/70 transition-transform motion-reduce:transition-none",
                        open && "rotate-180",
                      )}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                      >
                        {renderOrganizePanel(w)}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {viewMode === "model" ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Users className="h-4 w-4 text-[#D4AF8C]" />
            <h2 className="text-sm font-semibold text-white">Coverage by model</h2>
            <span className={cn(VA_STATUS_BADGE, "bg-white/10 text-white/60")}>
              {filteredModels.length}
            </span>
          </div>
          {filteredModels.length === 0 ? (
            <ReviewEmptyState
              icon={Cloud}
              title={models.length === 0 ? "No model coverage yet" : "No matches"}
              description={
                models.length === 0
                  ? "Once iCloud managers submit folders, per-model coverage and runway appear here."
                  : "Try clearing filters or searching a different folder label."
              }
            />
          ) : (
            <div className="space-y-4">
              {filteredModels.map((m) => {
                const open = expandedModelId === m.model_id;
                const attention = m.runway === "urgent" || m.runway === "low" || m.runway === "none";
                return (
                  <motion.div
                    key={m.model_id}
                    layout
                    className={cn(
                      VA_CARD,
                      VA_CARD_GLOW,
                      "relative overflow-hidden",
                      m.runway === "urgent"
                        ? "border-red-500/25 ring-1 ring-red-500/10"
                        : m.runway === "low"
                          ? "border-amber-500/25 ring-1 ring-amber-500/10"
                          : "",
                    )}
                  >
                    {attention ? (
                      <div
                        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-40 blur-3xl"
                        style={{
                          background:
                            m.runway === "urgent"
                              ? "radial-gradient(circle, rgba(239,68,68,0.35), transparent 70%)"
                              : m.runway === "low"
                                ? "radial-gradient(circle, rgba(251,191,36,0.28), transparent 70%)"
                                : "radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)",
                        }}
                      />
                    ) : null}
                    <button
                      type="button"
                      className="relative flex w-full items-start justify-between gap-3 px-4 py-5 text-left sm:px-6"
                      onClick={() => setExpandedModelId(open ? null : m.model_id)}
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {(m.runway === "urgent" || m.runway === "low") && (
                            <AlertTriangle
                              className={cn(
                                "h-4 w-4",
                                m.runway === "urgent" ? "text-red-300" : "text-amber-300",
                              )}
                            />
                          )}
                          <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                            {m.model_name}
                          </h3>
                          <span className={cn(VA_STATUS_BADGE, MATERIAL_RUNWAY_STYLES[m.runway])}>
                            {MATERIAL_RUNWAY_LABELS[m.runway]}
                          </span>
                          {m.needs_organization_count > 0 ? (
                            <span className={cn(VA_STATUS_BADGE, "bg-[#FF1493]/15 text-[#FF1493]")}>
                              {m.needs_organization_count} need
                              {m.needs_organization_count === 1 ? "s" : ""} org
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm font-medium text-[#D4AF8C] sm:text-base">
                          {coverageHeroLine(m.furthest_material_until, m.days_remaining)}
                        </p>
                        <p className="text-xs text-[#B8B4B8]/50">
                          {m.folders.length} folder{m.folders.length === 1 ? "" : "s"}
                          {m.folders.length > 0 ? " · soonest-expiring first" : ""}
                        </p>
                      </div>
                      <ChevronDown
                        className={cn(
                          "mt-1 h-5 w-5 shrink-0 text-[#D4AF8C]/70 transition-transform motion-reduce:transition-none",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {open ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="relative border-t border-white/[0.06]"
                        >
                          <div className="space-y-3 px-4 py-4 sm:px-6">
                            {m.folders.length === 0 ? (
                              <ReviewEmptyState
                                icon={FolderOpen}
                                title="No folders organized yet for this model"
                                description="When an iCloud manager submits folders for this model’s bunches, they appear here with links and coverage dates."
                              />
                            ) : (
                              <ul className="space-y-2">
                                {m.folders.map((f) => (
                                  <FolderRow key={f.id} folder={f} showBunch />
                                ))}
                              </ul>
                            )}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Layers className="h-4 w-4 text-[#D4AF8C]" />
            <h2 className="text-sm font-semibold text-white">By bunch</h2>
            <span className={cn(VA_STATUS_BADGE, "bg-white/10 text-white/60")}>
              {filteredWork.length}
            </span>
          </div>
          {filteredWork.length === 0 ? (
            <ReviewEmptyState
              icon={Cloud}
              title={work.length === 0 ? "No bunches ready for iCloud yet" : "No matches"}
              description={
                work.length === 0
                  ? "After editors submit Edited & Uploaded, bunches appear here for organization."
                  : "Try clearing filters or searching a different term."
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredWork.map((w) => {
                const open = expandedBunchId === w.bunch.id;
                const st = ICLOUD_STATUS_STYLES[w.bunch.icloud_status] ?? ICLOUD_STATUS_STYLES.pending;
                const days = daysUntilMaterialDate(w.furthest_material_until);
                const tier = materialRunwayTier(days);
                const isDone = w.bunch.icloud_status === "organized";
                return (
                  <motion.div
                    key={w.bunch.id}
                    layout
                    className={cn(VA_CARD, VA_CARD_GLOW, "overflow-hidden")}
                  >
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left sm:px-5"
                      onClick={() => setExpandedBunchId(open ? null : w.bunch.id)}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">{w.bunch.name}</h3>
                          <span className={cn(VA_STATUS_BADGE, st.className)}>{st.label}</span>
                          <span className={cn(VA_STATUS_BADGE, MATERIAL_RUNWAY_STYLES[tier])}>
                            {MATERIAL_RUNWAY_LABELS[tier]}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[#D4AF8C]/80">
                          {w.bunch.model_name || "—"}
                        </p>
                        <p className="mt-1 text-xs text-[#B8B4B8]/50">
                          {w.folders.length} folder{w.folders.length === 1 ? "" : "s"}
                          {w.furthest_material_until
                            ? ` · ${coverageHeroLine(w.furthest_material_until, days)}`
                            : ""}
                        </p>
                      </div>
                      <ChevronDown
                        className={cn(
                          "mt-1 h-5 w-5 shrink-0 text-[#D4AF8C]/70 transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {open ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                          {isDone ? (
                            <div className="space-y-3 border-t border-white/[0.06] px-4 py-4 sm:px-5">
                              <p className="flex items-center gap-2 text-sm text-emerald-300">
                                <CheckCircle2 className="h-4 w-4" /> Organization complete
                              </p>
                              <ul className="space-y-2">
                                {w.folders.map((f) => (
                                  <FolderRow key={f.id} folder={f} />
                                ))}
                              </ul>
                            </div>
                          ) : (
                            renderOrganizePanel(w)
                          )}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
