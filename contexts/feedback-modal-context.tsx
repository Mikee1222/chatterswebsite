"use client";

import * as React from "react";
import { FeedbackModal } from "@/components/feedback-modal";

type FeedbackModalContextValue = {
  openFeedback: () => void;
};

const FeedbackModalContext = React.createContext<FeedbackModalContextValue | null>(null);

export function FeedbackModalProvider(props: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const openFeedback = React.useCallback(() => setOpen(true), []);

  const value = React.useMemo(() => ({ openFeedback }), [openFeedback]);

  return (
    <FeedbackModalContext.Provider value={value}>
      {props.children}
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </FeedbackModalContext.Provider>
  );
}

export function useFeedbackModal(): FeedbackModalContextValue {
  const ctx = React.useContext(FeedbackModalContext);
  if (!ctx) {
    throw new Error("useFeedbackModal must be used within FeedbackModalProvider");
  }
  return ctx;
}
