"use client";

import * as React from "react";
import { ExternalLink, FileText, Loader2, X } from "lucide-react";
import {
  FindingCard,
  ManagerReviewTextarea,
  QuickActionEscalate,
  QuickActionMarkFixed,
  ReviewEmptyState,
  ReviewFieldLabel,
  ReviewLoadingState,
  ReviewModalShell,
  ReviewSectionHeader,
  ScriptStatusBadge,
  VA_BTN_SECONDARY,
  displayOrDash,
} from "@/components/manager-review-ui";
import { WinnerVideoCopyButton, winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { useToast } from "@/contexts/toast-context";
import { formatCreativeScriptCopy } from "@/lib/creative-scripts-copy";
import { formatDateTimeAthens } from "@/lib/format";
import { copyTextToClipboard } from "@/lib/winner-videos-copy";
import { cn } from "@/lib/utils";
import type { WinnerVideoRecord } from "@/services/winner-videos";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";

type Props = {
  initialScripts: WinnerVideoRecord[];
};

export function AdminCreativeScriptsReview({ initialScripts }: Props) {
  const { addToast } = useToast();
  const isSupabaseBackend = useIsSupabaseBackend();
  const [scripts, setScripts] = React.useState(initialScripts);
  const [loading, setLoading] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [rejectId, setRejectId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  React.useEffect(() => setScripts(initialScripts), [initialScripts]);

  React.useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const s of scripts) {
        if (next[s.id] === undefined) next[s.id] = s.script_text ?? "";
      }
      return next;
    });
  }, [scripts]);

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/creative-scripts", { credentials: "include" });
      const data = (await res.json()) as { videos?: WinnerVideoRecord[] };
      if (res.ok) setScripts(data.videos ?? []);
    } finally {
      setLoading(false);
    }
  }

  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;

  React.useEffect(() => {
    if (isSupabaseBackend) return;
    const id = window.setInterval(() => {
      void reloadRef.current();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [isSupabaseBackend]);

  useSupabaseRealtimeRefresh(["winner_videos"], () => void reloadRef.current(), { debounceMs: 600 });

  async function patchScript(id: string, body: Record<string, unknown>) {
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/creative-scripts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { video?: WinnerVideoRecord; error?: string };
      if (!res.ok) {
        addToast(winnerVideoLocalToast(`acs-err-${Date.now()}`, "Update failed", data.error ?? "Could not update", "high"));
        return false;
      }
      if (body.action === "approve" || body.action === "reject") {
        setScripts((prev) => prev.filter((s) => s.id !== id));
      } else if (data.video) {
        setScripts((prev) => prev.map((s) => (s.id === id ? data.video! : s)));
      }
      return true;
    } finally {
      setPendingId(null);
    }
  }

  async function copyScript(video: WinnerVideoRecord) {
    const draft = drafts[video.id] ?? video.script_text ?? "";
    const ok = await copyTextToClipboard(
      formatCreativeScriptCopy({ ...video, script_text: draft }),
    );
    addToast(
      winnerVideoLocalToast(
        `acs-copy-${Date.now()}`,
        ok ? "Copied" : "Copy failed",
        ok ? "Script copied to clipboard." : "Could not copy.",
        ok ? "normal" : "high",
      ),
    );
  }

  return (
    <div className="space-y-4">
      <ReviewSectionHeader
        action={
          <button type="button" className={VA_BTN_SECONDARY} onClick={() => void reload()} disabled={loading}>
            Refresh
          </button>
        }
      >
        Scripts pending review ({scripts.length})
      </ReviewSectionHeader>

      {loading ? (
        <ReviewLoadingState />
      ) : scripts.length === 0 ? (
        <ReviewEmptyState
          icon={FileText}
          title="No scripts pending review"
          description="Submitted scripts will appear here for approval."
        />
      ) : (
        scripts.map((v) => {
          const draft = drafts[v.id] ?? v.script_text ?? "";
          return (
            <FindingCard key={v.id} pending={pendingId === v.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ScriptStatusBadge status={v.script_status} />
                    {v.script_submitted_at ? (
                      <span className="text-xs text-[#B8B4B8]/45">{formatDateTimeAthens(v.script_submitted_at)}</span>
                    ) : null}
                    <WinnerVideoCopyButton onClick={() => void copyScript(v)} label="Copy script" />
                  </div>
                  <p className="text-lg font-semibold text-white">{displayOrDash(v.assigned_creator_name)}</p>
                  <p className="text-xs text-[#D4AF8C]/75">
                    Type: {displayOrDash(v.script_video_type)} · By {displayOrDash(v.script_submitted_by_name)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <QuickActionMarkFixed
                    disabled={pendingId === v.id}
                    onClick={() => void patchScript(v.id, { action: "approve", script_text: draft })}
                  >
                    Approve
                  </QuickActionMarkFixed>
                  <QuickActionEscalate
                    disabled={pendingId === v.id}
                    onClick={() => {
                      setRejectId(v.id);
                      setRejectReason("");
                    }}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Reject
                  </QuickActionEscalate>
                </div>
              </div>

              {v.video_link ? (
                <a
                  href={v.video_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-[#FF1493] hover:underline"
                >
                  Reference video <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : null}

              <div className="mt-4">
                <ReviewFieldLabel>Script (editable)</ReviewFieldLabel>
                <ManagerReviewTextarea
                  value={draft}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [v.id]: e.target.value }))}
                  onBlur={() => {
                    if (draft.trim() && draft !== v.script_text) {
                      void patchScript(v.id, { action: "save", script_text: draft });
                    }
                  }}
                  rows={12}
                  className="mt-1.5"
                />
              </div>

              {pendingId === v.id ? (
                <p className="mt-2 flex items-center gap-2 text-xs text-[#B8B4B8]/50">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving…
                </p>
              ) : null}
            </FindingCard>
          );
        })
      )}

      {rejectId ? (
        <ReviewModalShell title="Reject script" onClose={() => setRejectId(null)}>
          <p className="mb-4 text-sm text-[#B8B4B8]/60">Script edits are saved. A rejection reason is required.</p>
          <div className="space-y-4">
            <div>
              <ReviewFieldLabel>Rejection reason</ReviewFieldLabel>
              <ManagerReviewTextarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="Explain what needs to change…"
                className="focus:border-red-500/55 focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.35),0_0_0_1px_rgba(239,68,68,0.25),0_0_20px_-6px_rgba(239,68,68,0.35)]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={VA_BTN_SECONDARY} onClick={() => setRejectId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition",
                  "border-red-500/40 bg-red-500/20 text-red-100 hover:bg-red-500/30",
                )}
                onClick={() => {
                  if (!rejectId) return;
                  const draft = drafts[rejectId] ?? "";
                  void (async () => {
                    const ok = await patchScript(rejectId, {
                      action: "reject",
                      script_text: draft,
                      script_rejection_reason: rejectReason,
                    });
                    if (ok) setRejectId(null);
                  })();
                }}
              >
                Reject
              </button>
            </div>
          </div>
        </ReviewModalShell>
      ) : null}
    </div>
  );
}
