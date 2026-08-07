"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  Cloud,
  ExternalLink,
  FolderPlus,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { ContentPipelineHero } from "@/components/content-pipeline-ui";
import {
  FilterBar,
  FilterChip,
  ReviewEmptyState,
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
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import {
  daysUntilMaterialDate,
  ICLOUD_STATUS_STYLES,
  materialRunwayAlert,
  type IcloudStatus,
} from "@/lib/icloud-helpers";
import type { IcloudBunchWork, IcloudFolderEntry } from "@/services/icloud";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: Array<{ value: "all" | IcloudStatus; label: string }> = [
  { value: "all", label: "All status" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "organized", label: "Organized" },
];

export function IcloudOrganizationClient({
  initialWork,
}: {
  initialWork: IcloudBunchWork[];
}) {
  const { addToast } = useToast();
  const [work, setWork] = React.useState(initialWork);
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(
    initialWork.find((w) => w.bunch.icloud_status !== "organized")?.bunch.id ??
      initialWork[0]?.bunch.id ??
      null,
  );
  const [drafts, setDrafts] = React.useState<
    Record<string, { label: string; link: string; until: string }>
  >({});
  const [folderRows, setFolderRows] = React.useState<
    Record<string, Array<{ label: string; link: string; until: string }>>
  >({});
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | IcloudStatus>("all");
  const [modelFilter, setModelFilter] = React.useState("all");
  const [alertFilter, setAlertFilter] = React.useState<"all" | "soon" | "past">("all");

  React.useEffect(() => setWork(initialWork), [initialWork]);

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch("/api/icloud/work", { credentials: "include" });
      const data = (await res.json()) as { work?: IcloudBunchWork[]; error?: string };
      if (res.ok) setWork(data.work ?? []);
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

  const models = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const w of work) {
      if (w.bunch.model_id) map.set(w.bunch.model_id, w.bunch.model_name || w.bunch.model_id);
    }
    return Array.from(map.entries()).map(([model_id, model_name]) => ({ model_id, model_name }));
  }, [work]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return work.filter((w) => {
      if (statusFilter !== "all" && w.bunch.icloud_status !== statusFilter) return false;
      if (modelFilter !== "all" && w.bunch.model_id !== modelFilter) return false;
      if (alertFilter !== "all") {
        const days = daysUntilMaterialDate(w.furthest_material_until);
        const alert = materialRunwayAlert(days);
        if (alert !== alertFilter) return false;
      }
      if (!q) return true;
      return [w.bunch.name, w.bunch.model_name, w.bunch.icloud_status]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [work, search, statusFilter, modelFilter, alertFilter]);

  const pending = work.filter((w) => w.bunch.icloud_status !== "organized");
  const done = work.filter((w) => w.bunch.icloud_status === "organized");
  const alertCount = work.filter((w) => {
    const days = daysUntilMaterialDate(w.furthest_material_until);
    return materialRunwayAlert(days) !== "ok";
  }).length;

  return (
    <div className="space-y-6">
      <ContentPipelineHero
        eyebrow="iCloud"
        title="iCloud Organization"
        description="Bunches with edited footage ready for folder organization. Add labeled folders with optional material runway dates, then mark complete."
        orb="champagne"
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
              label="Pending"
              value={<CountUp value={pending.length} />}
              accent="pink"
              glow
              tooltip="Bunches awaiting iCloud organization"
            />
            <LuxuryStatCard
              label="Organized"
              value={<CountUp value={done.length} />}
              accent="emerald"
              tooltip="Bunches marked complete"
            />
            <LuxuryStatCard
              label="Runway alerts"
              value={<CountUp value={alertCount} />}
              accent={alertCount > 0 ? "amber" : "white"}
              tooltip="Bunches with material soon or past"
            />
            <LuxuryStatCard
              label="Ready"
              value={<CountUp value={work.length} />}
              accent="champagne"
              tooltip="Total bunches in iCloud queue"
            />
          </div>
        }
      />

      {work.length > 0 ? (
        <FilterBar className={cn(VA_CARD, VA_CARD_GLOW, "space-y-3 p-4")}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative block min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B8B4B8]/35" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bunches…"
                className={cn(VA_FILTER_INPUT, "w-full pl-9")}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | IcloudStatus)}
                className={cn(VA_FILTER_INPUT, "min-w-[8rem]")}
              >
                {STATUS_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
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
                value={alertFilter}
                onChange={(e) => setAlertFilter(e.target.value as "all" | "soon" | "past")}
                className={cn(VA_FILTER_INPUT, "min-w-[8rem]")}
              >
                <option value="all">All runway</option>
                <option value="soon">Material soon</option>
                <option value="past">Material past</option>
              </select>
            </div>
          </div>
          {(search.trim() ||
            statusFilter !== "all" ||
            modelFilter !== "all" ||
            alertFilter !== "all") && (
            <div className="flex flex-wrap gap-2">
              {search.trim() ? (
                <FilterChip label={`Search: ${search.trim()}`} onRemove={() => setSearch("")} />
              ) : null}
              {statusFilter !== "all" ? (
                <FilterChip
                  label={`Status: ${STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? statusFilter}`}
                  onRemove={() => setStatusFilter("all")}
                />
              ) : null}
              {modelFilter !== "all" ? (
                <FilterChip
                  label={`Model: ${models.find((m) => m.model_id === modelFilter)?.model_name ?? modelFilter}`}
                  onRemove={() => setModelFilter("all")}
                />
              ) : null}
              {alertFilter !== "all" ? (
                <FilterChip
                  label={`Runway: ${alertFilter}`}
                  onRemove={() => setAlertFilter("all")}
                />
              ) : null}
            </div>
          )}
        </FilterBar>
      ) : null}

      {work.length === 0 ? (
        <ReviewEmptyState
          icon={Cloud}
          title="No bunches ready for iCloud yet"
          description="After editors submit Edited & Uploaded, bunches appear here for everyone with icloud_management:view."
        />
      ) : filtered.length === 0 ? (
        <ReviewEmptyState
          icon={Cloud}
          title="No matches"
          description="Try clearing filters or searching a different term."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((w) => {
            const st = ICLOUD_STATUS_STYLES[w.bunch.icloud_status] ?? ICLOUD_STATUS_STYLES.pending;
            const open = expandedId === w.bunch.id;
            const isDone = w.bunch.icloud_status === "organized";
            const days = daysUntilMaterialDate(w.furthest_material_until);
            const alert = materialRunwayAlert(days);
            const d = draftFor(w.bunch.id);
            const extras = extraRows(w.bunch.id);
            return (
              <motion.div key={w.bunch.id} layout className={cn(VA_CARD, VA_CARD_GLOW, "overflow-hidden")}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left sm:px-5"
                  onClick={() => setExpandedId(open ? null : w.bunch.id)}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">{w.bunch.name}</h2>
                      <span className={cn(VA_STATUS_BADGE, st.className)}>{st.label}</span>
                      {alert === "past" ? (
                        <span className={cn(VA_STATUS_BADGE, "bg-red-500/15 text-red-300")}>
                          Material past
                        </span>
                      ) : alert === "soon" ? (
                        <span className={cn(VA_STATUS_BADGE, "bg-amber-500/15 text-amber-300")}>
                          Material soon
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-[#D4AF8C]/80">{w.bunch.model_name || "—"}</p>
                    <p className="mt-1 text-xs text-[#B8B4B8]/50">
                      {w.folders.length} folder{w.folders.length === 1 ? "" : "s"}
                      {w.furthest_material_until
                        ? ` · material until ${w.furthest_material_until}`
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
                      className="border-t border-white/[0.06]"
                    >
                      <ul className="space-y-2 px-4 py-4 sm:px-5">
                        {w.folders.map((f) => (
                          <li
                            key={f.id}
                            className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0A0A0A]/60 px-3 py-2"
                          >
                            <FolderPlus className="h-4 w-4 text-[#D4AF8C]/70" />
                            <span className="text-sm text-white">{f.folder_label}</span>
                            {f.material_until_date ? (
                              <span className="text-[10px] text-[#B8B4B8]/50">
                                until {f.material_until_date}
                              </span>
                            ) : null}
                            {f.folder_link ? (
                              <a
                                href={f.folder_link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-[#FF1493] hover:underline"
                              >
                                Open <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                            {!isDone ? (
                              <button
                                type="button"
                                className={cn(VA_BTN_SECONDARY, "ml-auto px-2 py-1 text-xs")}
                                disabled={busyId === f.id}
                                onClick={() => void removeFolder(f)}
                                aria-label="Remove folder"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </li>
                        ))}
                        {w.folders.length === 0 ? (
                          <li className="text-xs text-[#B8B4B8]/45">No folders yet — add below.</li>
                        ) : null}
                      </ul>

                      {!isDone ? (
                        <div className="space-y-3 border-t border-white/[0.06] px-4 py-4 sm:px-5">
                          <p className="text-sm font-medium text-white">Add folders</p>
                          <p className="text-xs text-[#B8B4B8]/45">
                            Label · link · material until — add multiple rows before saving.
                          </p>
                          <div className="space-y-2">
                            <div className="grid gap-2 sm:grid-cols-3">
                              <input
                                className={VA_FILTER_INPUT}
                                placeholder="Label (required)"
                                value={d.label}
                                onChange={(e) =>
                                  setDrafts((p) => ({
                                    ...p,
                                    [w.bunch.id]: { ...d, label: e.target.value },
                                  }))
                                }
                              />
                              <input
                                className={VA_FILTER_INPUT}
                                placeholder="Link (optional)"
                                value={d.link}
                                onChange={(e) =>
                                  setDrafts((p) => ({
                                    ...p,
                                    [w.bunch.id]: { ...d, link: e.target.value },
                                  }))
                                }
                              />
                              <input
                                type="date"
                                className={VA_FILTER_INPUT}
                                value={d.until}
                                onChange={(e) =>
                                  setDrafts((p) => ({
                                    ...p,
                                    [w.bunch.id]: { ...d, until: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            {extras.map((row, idx) => (
                              <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                                <input
                                  className={VA_FILTER_INPUT}
                                  placeholder="Label"
                                  value={row.label}
                                  onChange={(e) =>
                                    setFolderRows((p) => {
                                      const next = [...(p[w.bunch.id] ?? [])];
                                      next[idx] = { ...next[idx], label: e.target.value };
                                      return { ...p, [w.bunch.id]: next };
                                    })
                                  }
                                />
                                <input
                                  className={VA_FILTER_INPUT}
                                  placeholder="Link"
                                  value={row.link}
                                  onChange={(e) =>
                                    setFolderRows((p) => {
                                      const next = [...(p[w.bunch.id] ?? [])];
                                      next[idx] = { ...next[idx], link: e.target.value };
                                      return { ...p, [w.bunch.id]: next };
                                    })
                                  }
                                />
                                <input
                                  type="date"
                                  className={VA_FILTER_INPUT}
                                  value={row.until}
                                  onChange={(e) =>
                                    setFolderRows((p) => {
                                      const next = [...(p[w.bunch.id] ?? [])];
                                      next[idx] = { ...next[idx], until: e.target.value };
                                      return { ...p, [w.bunch.id]: next };
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  className={cn(VA_BTN_SECONDARY, "px-2 py-1")}
                                  onClick={() =>
                                    setFolderRows((p) => ({
                                      ...p,
                                      [w.bunch.id]: (p[w.bunch.id] ?? []).filter((_, i) => i !== idx),
                                    }))
                                  }
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
                              onClick={() =>
                                setFolderRows((p) => ({
                                  ...p,
                                  [w.bunch.id]: [
                                    ...(p[w.bunch.id] ?? []),
                                    { label: "", link: "", until: "" },
                                  ],
                                }))
                              }
                            >
                              <Plus className="h-4 w-4" /> Add another folder
                            </button>
                            <button
                              type="button"
                              className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5")}
                              disabled={busyId === w.bunch.id}
                              onClick={() => void addAllFolders(w.bunch.id)}
                            >
                              {busyId === w.bunch.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FolderPlus className="h-4 w-4" />
                              )}
                              Save folders
                            </button>
                            <button
                              type="button"
                              className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-1.5")}
                              disabled={busyId === w.bunch.id || w.folders.length === 0}
                              onClick={() => void markComplete(w.bunch.id)}
                            >
                              {busyId === w.bunch.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Mark iCloud complete
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-t border-white/[0.06] px-4 py-4 sm:px-5">
                          <p className="flex items-center gap-2 text-sm text-emerald-300">
                            <CheckCircle2 className="h-4 w-4" /> Organization complete
                          </p>
                          <p className="mt-1 text-xs text-[#B8B4B8]/45">
                            Submitted view — folders locked for this bunch.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
