"use client";

import * as React from "react";
import { MessageSquarePlus } from "lucide-react";
import { FeedbackModal } from "@/components/feedback-modal";

export function FeedbackButton() {
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setFeedbackOpen(true)}
        className="fixed bottom-24 right-6 z-40 flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white/70 shadow-lg backdrop-blur-sm transition-all hover:bg-white/15 hover:text-white"
      >
        <MessageSquarePlus className="h-4 w-4" />
        Feedback
      </button>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}

