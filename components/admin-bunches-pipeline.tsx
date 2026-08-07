"use client";

import * as React from "react";
import { Search } from "lucide-react";
import {
  ContentPipelineHero,
  MaterialRunwayUrgencyCard,
  PipelineStageStepper,
} from "@/components/content-pipeline-ui";
import {
  FilterBar,
  FilterChip,
  ReviewEmptyState,
  ReviewLoadingState,
} from "@/components/manager-review-ui";
import { CountUp, InflowwCustomDateRange, LuxuryStatCard } from "@/components/infloww-performance-ui";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/lib/use-pagination";
import {
  VA_CARD,
  VA_CARD_GLOW,
  VA_FILTER_INPUT,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { EDITING_STATUS_STYLES } from "@/lib/editing-helpers";
import { FILMING_STATUS_STYLES } from "@/lib/filming-helpers";
import {
  ICLOUD_STATUS_STYLES,
  materialRunwayTier,
  daysUntilMaterialDate,
} from "@/lib/icloud-helpers";
import type { ModelMaterialRunway } from "@/services/icloud";
import type { VideoBunch } from "@/services/winner-sourcing";
import { FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;
const STAGES = ["Sourcing", "Scripting", "Filming", "Editing", "iCloud"] as const;

function stageIndex(b: VideoBunch): number {
  if (b.icloud_status === "organized") return 4;
  if (b.editing_status === "uploaded") return 4;
  if (b.editing_status === "assigned" || b.editing_status === "in_progress") return 3;
  if (b.filming_status === "uploaded") return 3;
  if (b.filming_status === "assigned" || b.filming_status === "in_progress") return 2;
  if (b.assigned_filmer_id) return 2;
  if (b.assigned_creative_id) return 1;
  if ((b.provided_count ?? 0) > 0 || (b.pending_review_count ?? 0) > 0) return 0;
  return 0;
}

function ymdFromIso(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AdminBunchesPipeline({
  bunches,
  modelRunways,
  loading,
  creatives = [],
  filmers = [],
  editors = [],
}: {
  bunches: VideoBunch[];
  modelRunways: ModelMaterialRunway[];
  loading?: boolean;
  creatives?: Array<{ id: string; name: string }>;
  filmers?: Array<{ id: string; name: string }>;
  editors?: Array<{ id: string; name: string }>;
}) {
  const todayYmd = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const monthAgoYmd = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const [search, setSearch] = React.useState("");
  const [modelFilter, setModelFilter] = React.useState("all");
  const [stageFilter, setStageFilter] = React.useState<"all" | number>("all");
  const [creativeFilter, setCreativeFilter] = React.useState("all");
  const [filmerFilter, setFilmerFilter] = React.useState("all");
  const [editorFilter, setEditorFilter] = React.useState("all");
  const [dateStart, setDateStart] = React.useState(monthAgoYmd);
  const [dateEnd, setDateEnd] = React.useState(todayYmd);
  const [dateApplied, setDateApplied] = React.useState<{ start: string; end: string } | null>(null);

  const models = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bunches) {
      if (b.model_id) map.set(b.model_id, b.model_name || b.model_id);
    }
    for (const m of modelRunways) {
      if (m.model_id) map.set(m.model_id, m.model_name || m.model_id);
    }
    return Array.from(map.entries())
      .map(([model_id, model_name]) => ({ model_id, model_name }))
      .sort((a, b) => a.model_name.localeCompare(b.model_name));
  }, [bunches, modelRunways]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return bunches.filter((b) => {
      if (modelFilter !== "all" && b.model_id !== modelFilter) return false;
      if (stageFilter !== "all" && stageIndex(b) !== stageFilter) return false;
      if (creativeFilter !== "all") {
        if (creativeFilter === "__none__") {
          if (b.assigned_creative_id) return false;
        } else if (b.assigned_creative_id !== creativeFilter) return false;
      }
      if (filmerFilter !== "all") {
        if (filmerFilter === "__none__") {
          if (b.assigned_filmer_id) return false;
        } else if (b.assigned_filmer_id !== filmerFilter) return false;
      }
      if (editorFilter !== "all") {
        if (editorFilter === "__none__") {
          if (b.assigned_editor_id) return false;
        } else if (b.assigned_editor_id !== editorFilter) return false;
      }
      if (dateApplied) {
        const ymd = ymdFromIso(b.updated_at || b.created_at);
        if (!ymd) return false;
        if (ymd < dateApplied.start || ymd > dateApplied.end) return false;
      }
      if (!q) return true;
      const hay = [
        b.name,
        b.model_name,
        b.assigned_creative_name,
        b.assigned_filmer_name,
        b.assigned_editor_name,
        b.filming_status,
        b.editing_status,
        b.icloud_status,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [
    bunches,
    search,
    modelFilter,
    stageFilter,
    creativeFilter,
    filmerFilter,
    editorFilter,
    dateApplied,
  ]);

  const { page, setPage, totalPages, paginated, reset } = usePagination(filtered, PAGE_SIZE);
  React.useEffect(() => {
    reset();
  }, [search, modelFilter, stageFilter, creativeFilter, filmerFilter, editorFilter, dateApplied, reset]);

  const alerts = modelRunways.filter((m) => m.alert === "urgent" || m.alert === "low" || m.alert === "none");
  const stageCounts = React.useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const b of bunches) counts[stageIndex(b)] += 1;
    return counts;
  }, [bunches]);

  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (modelFilter !== "all") {
    const name = models.find((m) => m.model_id === modelFilter)?.model_name ?? modelFilter;
    activeChips.push({ key: "model", label: `Model: ${name}`, clear: () => setModelFilter("all") });
  }
  if (stageFilter !== "all") {
    activeChips.push({
      key: "stage",
      label: `Stage: ${STAGES[stageFilter]}`,
      clear: () => setStageFilter("all"),
    });
  }
  if (creativeFilter !== "all") {
    const name =
      creativeFilter === "__none__"
        ? "No creative"
        : creatives.find((c) => c.id === creativeFilter)?.name ?? creativeFilter;
    activeChips.push({
      key: "creative",
      label: `Creative: ${name}`,
      clear: () => setCreativeFilter("all"),
    });
  }
  if (filmerFilter !== "all") {
    const name =
      filmerFilter === "__none__"
        ? "No filmer"
        : filmers.find((f) => f.id === filmerFilter)?.name ?? filmerFilter;
    activeChips.push({ key: "filmer", label: `Filmer: ${name}`, clear: () => setFilmerFilter("all") });
  }
  if (editorFilter !== "all") {
    const name =
      editorFilter === "__none__"
        ? "No editor"
        : editors.find((e) => e.id === editorFilter)?.name ?? editorFilter;
    activeChips.push({ key: "editor", label: `Editor: ${name}`, clear: () => setEditorFilter("all") });
  }
  if (dateApplied) {
    activeChips.push({
      key: "date",
      label: `${dateApplied.start} → ${dateApplied.end}`,
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

  if (loading) {
    return <ReviewLoadingState label="Loading pipeline…" />;
  }

  return (
    <div className="space-y-6">
      <ContentPipelineHero
        eyebrow="Command center"
        title="Bunch Pipeline Overview"
        description="Full stage timeline · model material runway · filming schedule context"
        orb="both"
        stats={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <LuxuryStatCard
              label="Bunches"
              value={<CountUp value={bunches.length} />}
              accent="white"
              tooltip="Total bunches in the pipeline"
            />
            <LuxuryStatCard
              label="Runway alerts"
              value={<CountUp value={alerts.length} />}
              accent={alerts.length > 0 ? "amber" : "emerald"}
              tooltip="Models with material runway past or within 7 days"
              glow={alerts.length > 0}
            />
            <LuxuryStatCard
              label="In filming"
              value={<CountUp value={stageCounts[2]} />}
              accent="pink"
              tooltip="Bunches currently in the Filming stage"
            />
            <LuxuryStatCard
              label="In editing"
              value={<CountUp value={stageCounts[3]} />}
              accent="champagne"
              tooltip="Bunches currently in the Editing stage"
            />
          </div>
        }
      />

      {alerts.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Material runway urgency</h3>
            <span className={cn(VA_STATUS_BADGE, "bg-amber-500/15 text-amber-300")}>
              {alerts.length} alert{alerts.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {alerts.map((m) => (
              <MaterialRunwayUrgencyCard
                key={m.model_id}
                modelName={m.model_name}
                furthestMaterialUntil={m.furthest_material_until}
                daysRemaining={m.days_remaining}
                alert={m.alert}
                nextShoot={m.next_shoot}
                lastShoot={m.last_shoot}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Model runway & shoots</h3>
        {modelRunways.length === 0 ? (
          <ReviewEmptyState
            icon={FolderKanban}
            title="No model runway data yet"
            description="Material dates and shoot schedule will appear once iCloud folders and filming calendar entries exist."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {modelRunways.map((m) => {
              const days = m.days_remaining ?? daysUntilMaterialDate(m.furthest_material_until);
              const alert = m.alert ?? materialRunwayTier(days);
              return (
                <MaterialRunwayUrgencyCard
                  key={m.model_id}
                  modelName={m.model_name}
                  furthestMaterialUntil={m.furthest_material_until}
                  daysRemaining={days}
                  alert={alert}
                  nextShoot={m.next_shoot}
                  lastShoot={m.last_shoot}
                />
              );
            })}
          </div>
        )}
      </section>

      <FilterBar className={cn(VA_CARD, VA_CARD_GLOW, "space-y-3 p-4")}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B8B4B8]/35" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bunches, models, assignees…"
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
              {models.map((m) => (
                <option key={m.model_id} value={m.model_id}>
                  {m.model_name}
                </option>
              ))}
            </select>
            <select
              value={stageFilter === "all" ? "all" : String(stageFilter)}
              onChange={(e) =>
                setStageFilter(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className={cn(VA_FILTER_INPUT, "min-w-[8rem]")}
            >
              <option value="all">All stages</option>
              {STAGES.map((s, i) => (
                <option key={s} value={i}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={creativeFilter}
              onChange={(e) => setCreativeFilter(e.target.value)}
              className={cn(VA_FILTER_INPUT, "min-w-[8rem]")}
            >
              <option value="all">All creatives</option>
              <option value="__none__">No creative</option>
              {creatives.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={filmerFilter}
              onChange={(e) => setFilmerFilter(e.target.value)}
              className={cn(VA_FILTER_INPUT, "min-w-[8rem]")}
            >
              <option value="all">All filmers</option>
              <option value="__none__">No filmer</option>
              {filmers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select
              value={editorFilter}
              onChange={(e) => setEditorFilter(e.target.value)}
              className={cn(VA_FILTER_INPUT, "min-w-[8rem]")}
            >
              <option value="all">All editors</option>
              <option value="__none__">No editor</option>
              {editors.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
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
        <p className="text-xs text-[#B8B4B8]/45">
          {filtered.length} bunch{filtered.length === 1 ? "" : "es"}
          {filtered.length !== bunches.length ? ` (of ${bunches.length})` : ""}
        </p>
      </FilterBar>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Stage timeline by bunch</h3>
        {paginated.length === 0 ? (
          <ReviewEmptyState
            icon={FolderKanban}
            title={bunches.length === 0 ? "No bunches yet" : "No matches for these filters"}
            description={
              bunches.length === 0
                ? "Create a bunch to start the content pipeline."
                : "Try clearing filters or widening the date range."
            }
          />
        ) : (
          <ul className="space-y-3">
            {paginated.map((b) => {
              const idx = stageIndex(b);
              const film = FILMING_STATUS_STYLES[b.filming_status] ?? FILMING_STATUS_STYLES.unassigned;
              const edit = EDITING_STATUS_STYLES[b.editing_status] ?? EDITING_STATUS_STYLES.unassigned;
              const cloud = ICLOUD_STATUS_STYLES[b.icloud_status] ?? ICLOUD_STATUS_STYLES.pending;
              return (
                <li key={b.id} className={cn(VA_CARD, VA_CARD_GLOW, "space-y-4 p-4 sm:p-5")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-white sm:text-lg">{b.name}</p>
                      <p className="mt-0.5 text-xs text-[#D4AF8C]/80">{b.model_name || "—"}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={cn(VA_STATUS_BADGE, film.className)}>Film: {film.label}</span>
                      <span className={cn(VA_STATUS_BADGE, edit.className)}>Edit: {edit.label}</span>
                      <span className={cn(VA_STATUS_BADGE, cloud.className)}>iCloud: {cloud.label}</span>
                    </div>
                  </div>
                  <PipelineStageStepper active={idx} />
                  <p className="text-[11px] text-[#B8B4B8]/45">
                    Creative: {b.assigned_creative_name || "—"} · Filmer:{" "}
                    {b.assigned_filmer_name || "—"} · Editor: {b.assigned_editor_name || "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {totalPages > 1 ? (
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
          />
        ) : null}
      </section>
    </div>
  );
}
