"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { UserCheck, X } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import {
  COMPLETE_THRESHOLD,
  formatRelativeShort,
  isUpdatedThisWeek,
} from "@/lib/persona-completeness";
import { PERSONA_SECTION_LABELS, type PersonaSectionKey } from "@/lib/persona-types";
import type { PersonaListSummary } from "@/lib/persona-types";
import {
  CompletenessRing,
  FilterBar,
  FilterChip,
  FiltersSheet,
  LiveBadge,
  LockedBadge,
  ModelAvatar,
  ModelChip,
  PsEmptyState,
  PsPageHeader,
  PsStatsRow,
  SearchFilterRow,
  SectionDots,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CARD_GLOW,
  VA_FILTER_INPUT,
  cn,
} from "@/components/personas-studio/shared";

export type PersonaListRow = {
  model_id: string;
  model_name: string;
  team: "gunzo_team" | "chatting_agency" | string;
  summary: PersonaListSummary | null;
};

type CompletenessFilter = "all" | "complete" | "incomplete" | "missing_birth";

type Props = {
  rows: PersonaListRow[];
  canViewSensitive: boolean;
};

export function PersonasListClient({ rows, canViewSensitive }: Props) {
  const reduce = useReducedMotion();
  const [search, setSearch] = React.useState("");
  const [modelFilter, setModelFilter] = React.useState("");
  const [completeness, setCompleteness] = React.useState<CompletenessFilter>("all");
  const [teamFilter, setTeamFilter] = React.useState("");
  const [liveOnly, setLiveOnly] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const stats = React.useMemo(() => {
    let complete = 0;
    let incomplete = 0;
    let missingBirth = 0;
    let updatedWeek = 0;
    for (const r of rows) {
      const s = r.summary;
      const pct = s?.completeness ?? 0;
      if (pct >= COMPLETE_THRESHOLD) complete += 1;
      else incomplete += 1;
      if (!s?.has_birth_date || !s?.is_adult) missingBirth += 1;
      if (isUpdatedThisWeek(s?.updated_at)) updatedWeek += 1;
    }
    return {
      total: rows.length,
      complete,
      incomplete,
      missingBirth,
      updatedWeek,
    };
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (modelFilter && r.model_id !== modelFilter) return false;
      if (teamFilter && r.team !== teamFilter) return false;
      if (liveOnly && !r.summary?.has_live_updates) return false;
      const pct = r.summary?.completeness ?? 0;
      if (completeness === "complete" && pct < COMPLETE_THRESHOLD) return false;
      if (completeness === "incomplete" && pct >= COMPLETE_THRESHOLD) return false;
      if (
        completeness === "missing_birth" &&
        r.summary?.has_birth_date &&
        r.summary?.is_adult
      ) {
        return false;
      }
      if (q && !r.model_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, modelFilter, teamFilter, liveOnly, completeness]);

  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (modelFilter) {
    const name = rows.find((r) => r.model_id === modelFilter)?.model_name ?? "Model";
    chips.push({ key: "model", label: name, clear: () => setModelFilter("") });
  }
  if (completeness !== "all") {
    chips.push({
      key: "comp",
      label:
        completeness === "complete"
          ? "Complete"
          : completeness === "incomplete"
            ? "Incomplete"
            : "Missing birth / 18+",
      clear: () => setCompleteness("all"),
    });
  }
  if (teamFilter) {
    chips.push({
      key: "team",
      label: teamFilter === "chatting_agency" ? "Agency" : "Gunzo",
      clear: () => setTeamFilter(""),
    });
  }
  if (liveOnly) {
    chips.push({ key: "live", label: "Has live updates", clear: () => setLiveOnly(false) });
  }

  const clearAll = () => {
    setSearch("");
    setModelFilter("");
    setCompleteness("all");
    setTeamFilter("");
    setLiveOnly(false);
  };

  const filterControls = (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
          Model
        </p>
        <select
          className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
        >
          <option value="">All models</option>
          {rows.map((r) => (
            <option key={r.model_id} value={r.model_id}>
              {r.model_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
          Completeness
        </p>
        <select
          className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
          value={completeness}
          onChange={(e) => setCompleteness(e.target.value as CompletenessFilter)}
        >
          <option value="all">All</option>
          <option value="complete">Complete</option>
          <option value="incomplete">Incomplete</option>
          <option value="missing_birth">Missing birth date / 18+</option>
        </select>
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
          Team
        </p>
        <select
          className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        >
          <option value="">All teams</option>
          <option value="gunzo_team">Gunzo</option>
          <option value="chatting_agency">Agency</option>
        </select>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm text-white/70">
        <input
          type="checkbox"
          checked={liveOnly}
          onChange={(e) => setLiveOnly(e.target.checked)}
          className="h-4 w-4 rounded border-white/20"
        />
        Has live updates
      </label>
      {chips.length > 0 && (
        <button type="button" className={cn(VA_BTN_SECONDARY, "w-full min-h-11")} onClick={clearAll}>
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <PsPageHeader
        eyebrow="Creators"
        title="Model Personas"
        description="Structured profiles that ground chatting voice and AI Creative Studio. Completeness drives better captions."
        icon={UserCheck}
      />

      <PsStatsRow
        stats={[
          { label: "Total", value: stats.total, accent: "champagne", tooltip: "Models in your scope" },
          {
            label: "Complete",
            value: stats.complete,
            accent: "emerald",
            tooltip: `≥${Math.round(COMPLETE_THRESHOLD * 100)}% filled`,
          },
          {
            label: "Incomplete",
            value: stats.incomplete,
            accent: "pink",
            tooltip: "Below completeness threshold",
          },
          {
            label: "Missing 18+",
            value: stats.missingBirth,
            accent: "amber",
            tooltip: "Birth date missing or under 18 — AI generation blocked",
          },
          {
            label: "Updated week",
            value: stats.updatedWeek,
            accent: "white",
            tooltip: "Persona saved in the last 7 days",
          },
        ]}
      />

      <div className={cn(VA_CARD, "mt-5 space-y-4 p-4 md:p-5")}>
        <SearchFilterRow
          search={search}
          onSearch={setSearch}
          onOpenFilters={() => setSheetOpen(true)}
          filterCount={chips.length}
        />
        <div className="hidden gap-3 md:grid md:grid-cols-4">{filterControls}</div>
        {chips.length > 0 && (
          <FilterBar className="!border-0 !bg-transparent !p-0 !shadow-none">
            {chips.map((c) => (
              <FilterChip key={c.key} label={c.label} onRemove={c.clear} />
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-white/40"
            >
              <X className="h-3.5 w-3.5" /> Clear all
            </button>
          </FilterBar>
        )}
      </div>

      <FiltersSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Persona filters">
        {filterControls}
      </FiltersSheet>

      <div className="mt-5">
        {filtered.length === 0 ? (
          <PsEmptyState
            title="No personas match"
            description="Try clearing filters or search."
            action={
              chips.length || search ? (
                <button
                  type="button"
                  className={cn(VA_BTN_SECONDARY, "min-h-11 px-4")}
                  onClick={clearAll}
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row, i) => {
              const s = row.summary;
              const pct = s?.completeness ?? 0;
              const scoreKeys = Object.keys(s?.section_scores ?? {}) as PersonaSectionKey[];
              const scores = scoreKeys.map((k) => s?.section_scores[k] ?? 0);
              const labels = scoreKeys.map((k) => PERSONA_SECTION_LABELS[k] ?? k);
              return (
                <motion.li
                  key={row.model_id}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                >
                  <Link
                    href={ROUTES.persona(row.model_id)}
                    className={cn(
                      VA_CARD,
                      VA_CARD_GLOW,
                      "flex min-h-[44px] flex-col gap-3 border border-white/[0.08] p-4 active:scale-[0.99]",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <ModelAvatar name={row.model_name} size={44} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-white">
                            {row.model_name}
                          </p>
                          <CompletenessRing value={pct} size={40} />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <ModelChip name={row.team === "chatting_agency" ? "Agency" : "Gunzo"} />
                          {s?.has_live_updates ? <LiveBadge /> : null}
                          {!canViewSensitive ? <LockedBadge /> : null}
                        </div>
                      </div>
                    </div>
                    <SectionDots scores={scores} labels={labels} />
                    <p className="text-[11px] text-white/35">
                      {s?.updated_at
                        ? `Updated ${formatRelativeShort(s.updated_at)}${
                            s.last_updated_by_name ? ` · ${s.last_updated_by_name}` : ""
                          }`
                        : "No persona yet — tap to create"}
                      {s && (!s.has_birth_date || !s.is_adult)
                        ? " · Birth date / 18+ needed for AI"
                        : ""}
                    </p>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
