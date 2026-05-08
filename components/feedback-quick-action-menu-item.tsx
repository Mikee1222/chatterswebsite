"use client";

import * as React from "react";
import { MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeedbackModal } from "@/contexts/feedback-modal-context";

/** Mobile bottom sheet row — matches link rows in `QuickActionsModal` et al. */
export function FeedbackQuickActionSheetRow({ onClose }: { onClose: () => void }) {
  const { openFeedback } = useFeedbackModal();
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onClose();
          openFeedback();
        }}
        className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-[15px] font-medium text-white/95 transition-colors active:bg-white/10"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400">
          <MessageSquarePlus className="h-5 w-5" />
        </span>
        Report bug / Suggestion
      </button>
    </li>
  );
}

/** Desktop FAB dropdown row — matches nav link rows above the + button. */
export function FeedbackQuickActionNavRow({ onClose }: { onClose: () => void }) {
  const { openFeedback } = useFeedbackModal();
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onClose();
          openFeedback();
        }}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-white/95 transition-colors hover:bg-white/[0.08]"
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400">
          <MessageSquarePlus className="h-4 w-4" />
        </span>
        Report bug / Suggestion
      </button>
    </li>
  );
}
