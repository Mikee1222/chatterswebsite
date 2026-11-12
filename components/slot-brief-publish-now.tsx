"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { VA_BTN_PRIMARY } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type Result = {
  editing_published: number;
  posting_activated: number;
  skipped: { kind: "editing" | "posting"; id: string; title: string; reason: string }[];
};

/**
 * Shown on a DRAFT editing / posting brief whose idea already has an approved recording
 * brief: it should be live but could not be published at approval time (or was written
 * afterwards as a draft). Runs the idea's activation again.
 */
export function SlotBriefPublishNow({
  winnerVideoId,
  briefId,
  kind,
}: {
  winnerVideoId: string;
  briefId: string;
  kind: "editing" | "posting";
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [reason, setReason] = React.useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setReason(null);
    try {
      const res = await fetch(`/api/creative-scripts/${encodeURIComponent(winnerVideoId)}/activate-briefs`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; briefs?: Result };
      if (!res.ok || !data.briefs) {
        setReason(data.error || "Could not publish");
        return;
      }
      const mine = data.briefs.skipped.find((s) => s.id === briefId);
      if (mine) {
        setReason(mine.reason);
        return;
      }
      addToast(
        winnerVideoLocalToast(
          `sbp-ok-${Date.now()}`,
          "Brief is live",
          kind === "editing" ? "The editor was notified." : "VAs can open it now.",
          "normal",
        ),
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 py-3"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-100">
          The recording brief is approved, but this {kind} brief is still a draft.
        </p>
        <p className="mt-0.5 break-words text-xs text-amber-100/70">
          {reason
            ? `Not published: ${reason}. Fix it with Edit, then try again.`
            : kind === "editing"
              ? "Check that an editor is assigned, then publish it."
              : "Publish it so the VAs can open it."}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void publish()}
        className={cn(VA_BTN_PRIMARY, "min-h-10 px-4 text-sm disabled:opacity-50")}
      >
        {busy ? "Publishing…" : "Publish now"}
      </button>
    </div>
  );
}
