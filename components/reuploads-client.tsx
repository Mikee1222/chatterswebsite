"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { VA_CARD, VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { ReuploadTask } from "@/services/reupload-queue";

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Reuploads — trial outliers the Marketing Manager sent to the VAs: post the SAME file
 * to the main grid, paste the new link, press Done. No posting brief.
 */
export function ReuploadsClient({
  initialTasks,
  canManage,
}: {
  initialTasks: ReuploadTask[];
  canManage: boolean;
}) {
  const { addToast } = useToast();
  const [tasks, setTasks] = React.useState(initialTasks);
  const [links, setLinks] = React.useState<Record<string, string>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/reuploads", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json().catch(() => ({}))) as { tasks?: ReuploadTask[] };
    if (data.tasks) setTasks(data.tasks);
  }

  async function done(task: ReuploadTask) {
    const url = (links[task.id] ?? "").trim();
    if (!url) {
      addToast(
        winnerVideoLocalToast(`ru-err-${Date.now()}`, "Link missing", "Paste the link of the new main-grid post first.", "high"),
      );
      return;
    }
    setBusyId(task.id);
    try {
      const res = await fetch(`/api/reuploads/${task.id}/done`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(winnerVideoLocalToast(`ru-err-${Date.now()}`, "Not saved", data.error || "Error", "high"));
        return;
      }
      addToast(
        winnerVideoLocalToast(
          `ru-ok-${Date.now()}`,
          "Reupload saved",
          "The Marketing Manager was notified. The post now counts as a grid post.",
          "normal",
        ),
      );
      setLinks((p) => ({ ...p, [task.id]: "" }));
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const pending = tasks.filter((t) => !t.done_at);
  const finished = tasks.filter((t) => t.done_at);

  const card = (t: ReuploadTask) => (
    <li key={t.id} className={cn(VA_CARD, "space-y-3 p-4 md:p-5")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-white">{t.model_name || "—"}</span>
        {t.account_handle ? (
          <span className={cn(VA_STATUS_BADGE, "border-white/15 bg-white/[0.04] text-white/70")}>
            {t.account_handle}
          </span>
        ) : null}
        <span
          className={cn(
            VA_STATUS_BADGE,
            t.done_at
              ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-200"
              : "border-violet-400/40 bg-violet-400/15 text-violet-200",
          )}
        >
          {t.done_at ? "Grid" : "Trial"}
        </span>
        {!t.done_at && t.outlier_multiple != null ? (
          <span className={cn(VA_STATUS_BADGE, "border-amber-400/35 bg-amber-400/12 text-amber-200")}>
            ×{t.outlier_multiple} trial outlier
          </span>
        ) : null}
        <span className="ml-auto text-xs text-[#B8B4B8]/50">
          {t.done_at ? `Reuploaded ${shortDate(t.done_at)}` : `Sent ${shortDate(t.notified_at)}`}
        </span>
      </div>

      {t.done_at ? (
        t.grid_link ? (
          <a
            href={t.grid_link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[#FF1493]/90 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Main-grid post
          </a>
        ) : null
      ) : (
        <>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-[#B8B4B8]/80">
            <li>
              Open the trial post to see which video it is:{" "}
              <a
                href={t.trial_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#FF1493]/90 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                trial post
              </a>
            </li>
            <li>
              Post the <b className="text-white">same file</b> to the <b className="text-white">main grid</b>
              {t.account_handle ? ` of ${t.account_handle}` : ""}. Never download it from Instagram.
            </li>
            <li>Paste the link of the new post here and press Done.</li>
          </ol>
          {t.video_name || t.video_location_path ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-[#B8B4B8]/75">
              {t.video_name ? (
                <p>
                  File: <span className="font-medium text-white">{t.video_name}</span>
                </p>
              ) : null}
              {t.video_location_path ? <p className="mt-0.5 break-words">Folder: {t.video_location_path}</p> : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`reupload-link-${t.id}`}
              type="url"
              inputMode="url"
              value={links[t.id] ?? ""}
              onChange={(e) => setLinks((p) => ({ ...p, [t.id]: e.target.value }))}
              placeholder="https://www.instagram.com/reel/…"
              aria-label={`New main-grid link for ${t.model_name}`}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm text-white placeholder:text-white/35 focus:border-[#ec4899] focus:outline-none"
            />
            <button
              type="button"
              disabled={busyId === t.id}
              onClick={() => void done(t)}
              className="min-h-11 rounded-xl bg-gradient-to-br from-[#e91e8c] via-[#db2777] to-[#c026d3] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busyId === t.id ? "Saving…" : "Done"}
            </button>
          </div>
        </>
      )}
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-white">Reuploads</h1>
        <p className="text-sm text-[#B8B4B8]/60">
          Trial outliers to post again on the main grid — same file, no posting brief.
          {canManage ? " You see every model." : " You see the models whose accounts you run."}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#F2EFF2]">To do ({pending.length})</h2>
        {pending.length ? (
          <ul className="space-y-3">{pending.map(card)}</ul>
        ) : (
          <div className={cn(VA_CARD, "px-6 py-10 text-center text-sm text-[#B8B4B8]/50")}>
            Nothing to reupload right now. You get a notification when the Marketing Manager sends one.
          </div>
        )}
      </section>

      {finished.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[#F2EFF2]">Done, last 14 days ({finished.length})</h2>
          <ul className="space-y-3">{finished.map(card)}</ul>
        </section>
      ) : null}
    </div>
  );
}
