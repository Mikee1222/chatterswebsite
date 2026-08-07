"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FolderOpen,
  Loader2,
  PlayCircle,
  Search,
  Upload,
} from "lucide-react";
import {
  AssignmentProgressBar,
  ContentPipelineHero,
  SlotChecklistSection,
} from "@/components/content-pipeline-ui";
import {
  AttachmentLinks,
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
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { FILMING_STATUS_STYLES, type FilmingStatus } from "@/lib/filming-helpers";
import type { ShootAssignment, ShootSlotDetail } from "@/services/filming";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: Array<{ value: "all" | FilmingStatus; label: string }> = [
  { value: "all", label: "All status" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "uploaded", label: "Uploaded" },
];

export function ShootAssignmentsClient({
  initialAssignments,
}: {
  initialAssignments: ShootAssignment[];
}) {
  const { addToast } = useToast();
  const [assignments, setAssignments] = React.useState(initialAssignments);
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(
    initialAssignments[0]?.bunch.id ?? null,
  );
  const [uploadLinks, setUploadLinks] = React.useState<Record<string, string>>({});
  const [slotOpen, setSlotOpen] = React.useState<Record<string, boolean>>({});
  const [uploadModalBunchId, setUploadModalBunchId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | FilmingStatus>("all");
  const [modelFilter, setModelFilter] = React.useState("all");

  React.useEffect(() => setAssignments(initialAssignments), [initialAssignments]);

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch("/api/filming/assignments", { credentials: "include" });
      const data = (await res.json()) as { assignments?: ShootAssignment[]; error?: string };
      if (res.ok) setAssignments(data.assignments ?? []);
    } finally {
      setLoading(false);
    }
  }

  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;
  useSupabaseRealtimeRefresh(
    ["video_bunches", "recreate_video_slots"],
    () => void reloadRef.current(),
    { debounceMs: 700 },
  );

  async function toggleFilmed(slot: ShootSlotDetail, filmed: boolean) {
    setBusyId(slot.id);
    try {
      const res = await fetch(`/api/filming/slots/${encodeURIComponent(slot.id)}/filmed`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ filmed }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(`film-err-${Date.now()}`, "Update failed", data.error ?? "Could not update", "high"),
        );
        return;
      }
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function submitUpload(bunchId: string) {
    const link = (uploadLinks[bunchId] ?? "").trim();
    if (!link) {
      addToast(
        winnerVideoLocalToast(`film-val-${Date.now()}`, "Link required", "Paste the upload folder link.", "high"),
      );
      return;
    }
    setBusyId(bunchId);
    try {
      const res = await fetch(`/api/filming/bunches/${encodeURIComponent(bunchId)}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ upload_folder_link: link }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(`film-up-err-${Date.now()}`, "Upload failed", data.error ?? "Could not submit", "high"),
        );
        return;
      }
      addToast(
        winnerVideoLocalToast(`film-up-ok-${Date.now()}`, "Uploaded", "Folder link submitted — admins notified.", "normal"),
      );
      setUploadModalBunchId(null);
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  const models = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignments) {
      if (a.bunch.model_id) map.set(a.bunch.model_id, a.bunch.model_name || a.bunch.model_id);
    }
    return Array.from(map.entries()).map(([model_id, model_name]) => ({ model_id, model_name }));
  }, [assignments]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignments.filter((a) => {
      if (statusFilter !== "all" && a.bunch.filming_status !== statusFilter) return false;
      if (modelFilter !== "all" && a.bunch.model_id !== modelFilter) return false;
      if (!q) return true;
      return [a.bunch.name, a.bunch.model_name, a.bunch.filming_status]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [assignments, search, statusFilter, modelFilter]);

  const active = assignments.filter((a) => a.bunch.filming_status !== "uploaded");
  const done = assignments.filter((a) => a.bunch.filming_status === "uploaded");
  const uploadModalAssignment = uploadModalBunchId
    ? assignments.find((a) => a.bunch.id === uploadModalBunchId)
    : null;

  return (
    <div className="space-y-6">
      <ContentPipelineHero
        eyebrow="Filming"
        title="Shoot Assignments"
        description="Bunches with approved scripts assigned to you. Film each slot, then submit the upload folder when complete."
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <LuxuryStatCard
              label="Active"
              value={<CountUp value={active.length} />}
              accent="pink"
              glow
              tooltip="Assignments still in progress"
            />
            <LuxuryStatCard
              label="Uploaded"
              value={<CountUp value={done.length} />}
              accent="emerald"
              tooltip="Bunches with upload folder submitted"
            />
            <LuxuryStatCard
              label="Total"
              value={<CountUp value={assignments.length} />}
              accent="champagne"
              tooltip="All shoot assignments assigned to you"
            />
          </div>
        }
      />

      {assignments.length > 0 ? (
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
                onChange={(e) => setStatusFilter(e.target.value as "all" | FilmingStatus)}
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
            </div>
          </div>
          {(search.trim() || statusFilter !== "all" || modelFilter !== "all") && (
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
            </div>
          )}
        </FilterBar>
      ) : null}

      {assignments.length === 0 ? (
        <ReviewEmptyState
          icon={PlayCircle}
          title="No shoot assignments yet"
          description="When an admin assigns an approved bunch to you, it appears here."
        />
      ) : filtered.length === 0 ? (
        <ReviewEmptyState
          icon={PlayCircle}
          title="No matches"
          description="Try clearing filters or searching a different term."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((a) => {
            const st = FILMING_STATUS_STYLES[a.bunch.filming_status] ?? FILMING_STATUS_STYLES.assigned;
            const open = expandedId === a.bunch.id;
            const allFilmed = a.filmable_count > 0 && a.filmed_count >= a.filmable_count;
            const isUploaded = a.bunch.filming_status === "uploaded";
            return (
              <motion.div
                key={a.bunch.id}
                layout
                className={cn(VA_CARD, VA_CARD_GLOW, "overflow-hidden")}
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left sm:px-5"
                  onClick={() => setExpandedId(open ? null : a.bunch.id)}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">{a.bunch.name}</h2>
                      <span className={cn(VA_STATUS_BADGE, st.className)}>{st.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-[#D4AF8C]/80">{a.bunch.model_name || "—"}</p>
                    <p className="mt-1 text-xs tabular-nums text-[#B8B4B8]/50">
                      {a.filmed_count}/{a.filmable_count} filmed
                    </p>
                    <AssignmentProgressBar done={a.filmed_count} total={a.filmable_count} />
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
                      <ul className="space-y-3 px-4 py-4 sm:px-5">
                        {a.slots.map((slot) => {
                          const detailOpen = slotOpen[slot.id] ?? false;
                          return (
                            <li
                              key={slot.id}
                              className="rounded-xl border border-white/[0.06] bg-[#0A0A0A]/60 p-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium text-[#D4AF8C]">
                                  #{slot.sequence_number}
                                </span>
                                {slot.script_video_type ? (
                                  <span className="text-[10px] uppercase tracking-wider text-[#B8B4B8]/40">
                                    {slot.script_video_type}
                                  </span>
                                ) : null}
                                {slot.filmed ? (
                                  <span className={cn(VA_STATUS_BADGE, "bg-emerald-500/15 text-emerald-300")}>
                                    Filmed
                                  </span>
                                ) : (
                                  <span className={cn(VA_STATUS_BADGE, "bg-white/10 text-white/50")}>
                                    To film
                                  </span>
                                )}
                                <div className="ml-auto flex gap-2">
                                  <button
                                    type="button"
                                    className={cn(VA_BTN_SECONDARY, "min-h-[36px] px-2.5 py-1 text-xs")}
                                    onClick={() =>
                                      setSlotOpen((p) => ({ ...p, [slot.id]: !detailOpen }))
                                    }
                                  >
                                    {detailOpen ? "Hide" : "Checklist"}
                                  </button>
                                  {!isUploaded ? (
                                    <button
                                      type="button"
                                      className={cn(
                                        slot.filmed ? VA_BTN_SECONDARY : VA_BTN_PRIMARY,
                                        "inline-flex min-h-[36px] items-center gap-1 px-2.5 py-1 text-xs",
                                      )}
                                      disabled={busyId === slot.id}
                                      onClick={() => void toggleFilmed(slot, !slot.filmed)}
                                    >
                                      {busyId === slot.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                      )}
                                      {slot.filmed ? "Undo" : "Mark filmed"}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              {slot.video_link ? (
                                <a
                                  href={slot.video_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#FF1493]/90 hover:underline"
                                >
                                  Reference <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : null}
                              {detailOpen ? (
                                <div className="mt-3 space-y-3 border-t border-white/[0.05] pt-3">
                                  <SlotChecklistSection title="Script">
                                    <p className="whitespace-pre-wrap">
                                      {slot.script_text?.trim() || "—"}
                                    </p>
                                  </SlotChecklistSection>
                                  {slot.text_on_screen_suggestion?.trim() ? (
                                    <SlotChecklistSection title="Text on Screen">
                                      <p className="whitespace-pre-wrap">
                                        {slot.text_on_screen_suggestion}
                                      </p>
                                    </SlotChecklistSection>
                                  ) : null}
                                  {slot.script_brief?.trim() ||
                                  slot.script_brief_attachment_url?.trim() ? (
                                    <SlotChecklistSection title="Brief">
                                      {slot.script_brief?.trim() ? (
                                        <p className="whitespace-pre-wrap">{slot.script_brief}</p>
                                      ) : null}
                                      {slot.script_brief_attachment_url?.trim() ? (
                                        <div className="mt-2">
                                          <AttachmentLinks
                                            attachments={[
                                              {
                                                url: slot.script_brief_attachment_url,
                                                filename:
                                                  slot.script_brief_attachment_filename ||
                                                  "Brief attachment",
                                              },
                                            ]}
                                          />
                                        </div>
                                      ) : null}
                                    </SlotChecklistSection>
                                  ) : null}
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>

                      {isUploaded ? (
                        <div className="border-t border-white/[0.06] px-4 py-4 sm:px-5">
                          <p className="flex items-center gap-2 text-sm text-emerald-300">
                            <FolderOpen className="h-4 w-4" /> Uploaded
                          </p>
                          {a.bunch.upload_folder_link ? (
                            <a
                              href={a.bunch.upload_folder_link}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex text-sm text-[#FF1493] hover:underline"
                            >
                              Open folder link
                            </a>
                          ) : null}
                        </div>
                      ) : allFilmed ? (
                        <div className="space-y-3 border-t border-white/[0.06] px-4 py-4 sm:px-5">
                          <p className="text-sm font-medium text-white">
                            All slots filmed — ready to upload
                          </p>
                          <button
                            type="button"
                            className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-1.5")}
                            onClick={() => {
                              setUploadLinks((p) => ({
                                ...p,
                                [a.bunch.id]:
                                  p[a.bunch.id] ?? a.bunch.upload_folder_link ?? "",
                              }));
                              setUploadModalBunchId(a.bunch.id);
                            }}
                          >
                            <Upload className="h-4 w-4" /> Confirm uploaded
                          </button>
                        </div>
                      ) : null}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {uploadModalAssignment ? (
        <ReviewModalShell
          title="Confirm uploaded"
          onClose={() => busyId !== uploadModalAssignment.bunch.id && setUploadModalBunchId(null)}
          saving={busyId === uploadModalAssignment.bunch.id}
        >
          <p className="text-sm text-[#B8B4B8]/70">
            Paste the cloud folder link with the filmed files for{" "}
            <span className="font-medium text-white">{uploadModalAssignment.bunch.name}</span>.
            Admins with filming:manage are notified.
          </p>
          <input
            className={cn(VA_FILTER_INPUT, "mt-4 w-full")}
            placeholder="https://…"
            value={
              uploadLinks[uploadModalAssignment.bunch.id] ??
              uploadModalAssignment.bunch.upload_folder_link ??
              ""
            }
            onChange={(e) =>
              setUploadLinks((p) => ({
                ...p,
                [uploadModalAssignment.bunch.id]: e.target.value,
              }))
            }
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className={VA_BTN_SECONDARY}
              disabled={busyId === uploadModalAssignment.bunch.id}
              onClick={() => setUploadModalBunchId(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-1.5")}
              disabled={busyId === uploadModalAssignment.bunch.id}
              onClick={() => void submitUpload(uploadModalAssignment.bunch.id)}
            >
              {busyId === uploadModalAssignment.bunch.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Confirm uploaded
            </button>
          </div>
        </ReviewModalShell>
      ) : null}
    </div>
  );
}
