"use client";

import * as React from "react";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { VA_CARD, VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { RawSortingWork } from "@/services/icloud";

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Step between filming and editing: the filmer uploaded the raw footage, the iCloud manager
 * sorts it into the right folders and presses "Raw ready" → the editor is told to start.
 */
export function IcloudRawSortingPanel({ initialWork }: { initialWork: RawSortingWork[] }) {
  const { addToast } = useToast();
  const [work, setWork] = React.useState(initialWork);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function rawReady(w: RawSortingWork) {
    setBusyId(w.bunch_id);
    try {
      const res = await fetch(`/api/icloud/bunches/${encodeURIComponent(w.bunch_id)}/raw-ready`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; notified_editor?: boolean };
      if (!res.ok) {
        addToast(winnerVideoLocalToast(`raw-err-${Date.now()}`, "Not saved", data.error || "Error", "high"));
        return;
      }
      addToast(
        winnerVideoLocalToast(
          `raw-ok-${Date.now()}`,
          "Raw footage marked ready",
          data.notified_editor
            ? `${w.editor_name || "The editor"} was notified to start editing.`
            : "No editor is assigned to this bunch — the editing managers were notified.",
          "normal",
        ),
      );
      setWork((prev) => prev.filter((x) => x.bunch_id !== w.bunch_id));
    } finally {
      setBusyId(null);
    }
  }

  if (!work.length) return null;

  return (
    <section className={cn(VA_CARD, "mb-6 space-y-3 p-4 md:p-5")} aria-label="Raw footage to sort">
      <div>
        <h2 className="text-base font-semibold text-white">Raw footage to sort ({work.length})</h2>
        <p className="mt-0.5 text-xs text-[#B8B4B8]/60">
          The filmer uploaded these. Sort the files into the right folders, then press Raw ready so the
          editor can start.
        </p>
      </div>
      <ul className="space-y-2">
        {work.map((w) => (
          <li
            key={w.bunch_id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {w.model_name || "—"} · {w.bunch_name || "Bunch"}
              </p>
              <p className="mt-0.5 break-words text-xs text-[#B8B4B8]/60">
                Uploaded {shortDate(w.uploaded_at)}
                {w.filmer_name ? ` by ${w.filmer_name}` : ""}
                {w.upload_folder_names ? ` · ${w.upload_folder_names}` : ""}
              </p>
            </div>
            <span
              className={cn(
                VA_STATUS_BADGE,
                w.editor_name
                  ? "border-white/15 bg-white/[0.04] text-white/70"
                  : "border-amber-400/35 bg-amber-400/10 text-amber-200",
              )}
            >
              {w.editor_name ? `Editor: ${w.editor_name}` : "No editor assigned"}
            </span>
            <button
              type="button"
              disabled={busyId === w.bunch_id}
              onClick={() => void rawReady(w)}
              className="min-h-10 rounded-xl bg-gradient-to-br from-[#e91e8c] via-[#db2777] to-[#c026d3] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busyId === w.bunch_id ? "Saving…" : "Raw ready"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
