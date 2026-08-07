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
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import {
  daysUntilMaterialDate,
  ICLOUD_STATUS_STYLES,
  materialRunwayAlert,
} from "@/lib/icloud-helpers";
import type { IcloudBunchWork, IcloudFolderEntry } from "@/services/icloud";
import { cn } from "@/lib/utils";

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

  async function addFolder(bunchId: string) {
    const d = draftFor(bunchId);
    if (!d.label.trim()) {
      addToast(
        winnerVideoLocalToast(`icloud-val-${Date.now()}`, "Label required", "Enter a folder label.", "high"),
      );
      return;
    }
    setBusyId(bunchId);
    try {
      const res = await fetch("/api/icloud/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bunch_id: bunchId,
          folder_label: d.label,
          folder_link: d.link,
          material_until_date: d.until || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(`icloud-err-${Date.now()}`, "Failed", data.error ?? "Could not add folder", "high"),
        );
        return;
      }
      setDrafts((p) => ({ ...p, [bunchId]: { label: "", link: "", until: "" } }));
      await reload();
    } finally {
      setBusyId(null);
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

  const pending = work.filter((w) => w.bunch.icloud_status !== "organized");
  const done = work.filter((w) => w.bunch.icloud_status === "organized");

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-6 py-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[#D4AF8C]/10 blur-3xl" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/70">
          iCloud
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">iCloud Organization</h1>
        <p className="mt-2 max-w-xl text-sm text-[#B8B4B8]/70">
          Bunches with edited footage ready for folder organization. Add labeled folders with optional
          material runway dates, then mark complete.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className={cn(VA_STATUS_BADGE, "bg-[#FF1493]/15 text-[#FF1493]")}>
            {pending.length} pending
          </span>
          <span className={cn(VA_STATUS_BADGE, "bg-emerald-500/15 text-emerald-300")}>
            {done.length} organized
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

      {work.length === 0 ? (
        <div className={cn(VA_CARD, "flex flex-col items-center gap-3 px-6 py-16 text-center")}>
          <Cloud className="h-10 w-10 text-[#D4AF8C]/40" />
          <p className="text-sm text-[#B8B4B8]/60">No bunches ready for iCloud yet.</p>
          <p className="text-xs text-[#B8B4B8]/40">
            After editors submit Edited & Uploaded, bunches appear here for everyone with
            icloud_management:view.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {work.map((w) => {
            const st = ICLOUD_STATUS_STYLES[w.bunch.icloud_status] ?? ICLOUD_STATUS_STYLES.pending;
            const open = expandedId === w.bunch.id;
            const isDone = w.bunch.icloud_status === "organized";
            const days = daysUntilMaterialDate(w.furthest_material_until);
            const alert = materialRunwayAlert(days);
            const d = draftFor(w.bunch.id);
            return (
              <motion.div key={w.bunch.id} layout className={cn(VA_CARD, VA_CARD_GLOW, "overflow-hidden")}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left"
                  onClick={() => setExpandedId(open ? null : w.bunch.id)}
                >
                  <div>
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
                      <ul className="space-y-2 px-5 py-4">
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
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </li>
                        ))}
                        {w.folders.length === 0 ? (
                          <li className="text-xs text-[#B8B4B8]/45">No folders yet — add one below.</li>
                        ) : null}
                      </ul>

                      {!isDone ? (
                        <div className="space-y-3 border-t border-white/[0.06] px-5 py-4">
                          <p className="text-sm font-medium text-white">Add folder</p>
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
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5")}
                              disabled={busyId === w.bunch.id}
                              onClick={() => void addFolder(w.bunch.id)}
                            >
                              {busyId === w.bunch.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                              Add folder
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
                        <div className="border-t border-white/[0.06] px-5 py-4">
                          <p className="flex items-center gap-2 text-sm text-emerald-300">
                            <CheckCircle2 className="h-4 w-4" /> Organization complete
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
