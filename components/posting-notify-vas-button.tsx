"use client";

import * as React from "react";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { VA_BTN_SECONDARY } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

/** Marketing Manager: the edited videos are in the folder → tell the model's VAs to post now. */
export function PostingNotifyVasButton({ briefId, disabledReason }: { briefId: string; disabledReason?: string }) {
  const { addToast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState<number | null>(null);

  async function send() {
    setBusy(true);
    try {
      const res = await fetch(`/api/posting-briefs/${encodeURIComponent(briefId)}/notify-vas`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; notified?: number };
      if (!res.ok) {
        addToast(winnerVideoLocalToast(`pn-err-${Date.now()}`, "VAs not notified", data.error || "Error", "high"));
        return;
      }
      setSent(data.notified ?? 0);
      addToast(
        winnerVideoLocalToast(
          `pn-ok-${Date.now()}`,
          "VAs notified",
          `${data.notified ?? 0} VA(s) were told to post this brief now.`,
          "normal",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy || Boolean(disabledReason)}
      onClick={() => void send()}
      title={disabledReason || "The videos are in the folder: tell the VAs assigned to this model to post now"}
      className={cn(VA_BTN_SECONDARY, "min-h-10 border-violet-400/35 px-4 text-sm text-violet-200 disabled:opacity-50")}
    >
      {busy ? "Sending…" : sent != null ? `Notify VAs again (${sent} sent)` : "Notify VAs"}
    </button>
  );
}
