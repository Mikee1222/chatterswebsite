"use client";

import * as React from "react";
import { RebillModal } from "@/components/rebill-modal";
import { TipModal } from "@/components/tip-modal";
import type { ChatterModalModelOption } from "@/components/rebill-modal";
import { useChatterRebillTipFabContext } from "@/contexts/chatter-rebill-tip-fab-context";

/**
 * Registers rebill/tip FAB handlers and mounts modals for all chatter routes (not only home).
 */
export function ChatterRebillTipFabHost({ enabled }: { enabled: boolean }) {
  const setHandlers = useChatterRebillTipFabContext()?.setHandlers ?? null;
  const [rebillOpen, setRebillOpen] = React.useState(false);
  const [tipOpen, setTipOpen] = React.useState(false);
  const [models, setModels] = React.useState<ChatterModalModelOption[]>([]);

  const loadModels = React.useCallback(async () => {
    try {
      const res = await fetch("/api/chatter/active-models", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { models?: ChatterModalModelOption[] };
      setModels(Array.isArray(data.models) ? data.models : []);
    } catch {
      /* ignore */
    }
  }, []);

  React.useLayoutEffect(() => {
    if (!enabled || !setHandlers) return;
    setHandlers({
      openRebill: () => {
        void loadModels();
        setRebillOpen(true);
      },
      openTip: () => {
        void loadModels();
        setTipOpen(true);
      },
    });
    return () => {
      setHandlers(null);
    };
  }, [enabled, setHandlers, loadModels]);

  if (!enabled) return null;

  return (
    <>
      <RebillModal open={rebillOpen} onClose={() => setRebillOpen(false)} models={models} />
      <TipModal open={tipOpen} onClose={() => setTipOpen(false)} models={models} />
    </>
  );
}
