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
  Upload,
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
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { FILMING_STATUS_STYLES } from "@/lib/filming-helpers";
import type { ShootAssignment, ShootSlotDetail } from "@/services/filming";
import { cn } from "@/lib/utils";

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
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  const active = assignments.filter((a) => a.bunch.filming_status !== "uploaded");
  const done = assignments.filter((a) => a.bunch.filming_status === "uploaded");

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-6 py-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#FF1493]/10 blur-3xl" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/70">Filming</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Shoot Assignments</h1>
        <p className="mt-2 max-w-xl text-sm text-[#B8B4B8]/70">
          Bunches with approved scripts assigned to you. Film each slot, then submit the upload folder when complete.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className={cn(VA_STATUS_BADGE, "bg-[#FF1493]/15 text-[#FF1493]")}>
            {active.length} active
          </span>
          <span className={cn(VA_STATUS_BADGE, "bg-emerald-500/15 text-emerald-300")}>
            {done.length} uploaded
          </span>
          <button
            type="button"
            className={cn(VA_BTN_SECONDARY, "ml-auto")}
            onClick={() => void reload()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </button>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className={cn(VA_CARD, "flex flex-col items-center gap-3 px-6 py-16 text-center")}>
          <PlayCircle className="h-10 w-10 text-[#D4AF8C]/40" />
          <p className="text-sm text-[#B8B4B8]/60">No shoot assignments yet.</p>
          <p className="text-xs text-[#B8B4B8]/40">When an admin assigns an approved bunch to you, it appears here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
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
                  className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left"
                  onClick={() => setExpandedId(open ? null : a.bunch.id)}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">{a.bunch.name}</h2>
                      <span className={cn(VA_STATUS_BADGE, st.className)}>{st.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-[#D4AF8C]/80">{a.bunch.model_name || "—"}</p>
                    <p className="mt-1 text-xs text-[#B8B4B8]/50">
                      {a.filmed_count} of {a.filmable_count} filmed
                    </p>
                    <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#FF1493] to-[#D4AF8C] transition-all"
                        style={{
                          width: `${a.filmable_count ? Math.round((a.filmed_count / a.filmable_count) * 100) : 0}%`,
                        }}
                      />
                    </div>
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
                      className="border-t border-white/[0.06]"
                    >
                      <ul className="space-y-3 px-5 py-4">
                        {a.slots.map((slot) => {
                          const detailOpen = slotOpen[slot.id] ?? false;
                          return (
                            <li
                              key={slot.id}
                              className="rounded-xl border border-white/[0.06] bg-[#0A0A0A]/60 p-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium text-[#D4AF8C]">#{slot.sequence_number}</span>
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
                                    className={cn(VA_BTN_SECONDARY, "px-2.5 py-1 text-xs")}
                                    onClick={() =>
                                      setSlotOpen((p) => ({ ...p, [slot.id]: !detailOpen }))
                                    }
                                  >
                                    {detailOpen ? "Hide" : "Script"}
                                  </button>
                                  {!isUploaded ? (
                                    <button
                                      type="button"
                                      className={cn(
                                        slot.filmed ? VA_BTN_SECONDARY : VA_BTN_PRIMARY,
                                        "inline-flex items-center gap-1 px-2.5 py-1 text-xs",
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
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/65">
                                      Script
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-[#B8B4B8]/85">
                                      {slot.script_text?.trim() || "—"}
                                    </p>
                                  </div>
                                  {slot.text_on_screen_suggestion?.trim() ? (
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/65">
                                        Text on Screen
                                      </p>
                                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#B8B4B8]/85">
                                        {slot.text_on_screen_suggestion}
                                      </p>
                                    </div>
                                  ) : null}
                                  {slot.script_brief?.trim() ? (
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/65">
                                        Brief
                                      </p>
                                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#B8B4B8]/85">
                                        {slot.script_brief}
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>

                      {isUploaded ? (
                        <div className="border-t border-white/[0.06] px-5 py-4">
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
                        <div className="space-y-3 border-t border-white/[0.06] px-5 py-4">
                          <p className="text-sm font-medium text-white">All slots filmed — submit upload</p>
                          <p className="text-xs text-[#B8B4B8]/50">
                            Paste the cloud folder link with the filmed files. Admins with filming:manage are notified.
                          </p>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              className={cn(VA_FILTER_INPUT, "flex-1")}
                              placeholder="https://…"
                              value={uploadLinks[a.bunch.id] ?? a.bunch.upload_folder_link ?? ""}
                              onChange={(e) =>
                                setUploadLinks((p) => ({ ...p, [a.bunch.id]: e.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-1.5")}
                              disabled={busyId === a.bunch.id}
                              onClick={() => void submitUpload(a.bunch.id)}
                            >
                              {busyId === a.bunch.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                              Confirm uploaded
                            </button>
                          </div>
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
    </div>
  );
}
