"use client";

import * as React from "react";

export type ChatterRebillTipFabHandlers = {
  openRebill: () => void;
  openTip: () => void;
};

type Ctx = {
  handlers: ChatterRebillTipFabHandlers | null;
  setHandlers: (next: ChatterRebillTipFabHandlers | null) => void;
};

const ChatterRebillTipFabContext = React.createContext<Ctx | null>(null);

/** Wraps dashboard shell so the chatter FAB can open rebill/tip modals registered from the home page client. */
export function ChatterRebillTipFabProvider({ children }: { children: React.ReactNode }) {
  const [handlers, setHandlers] = React.useState<ChatterRebillTipFabHandlers | null>(null);
  const value = React.useMemo(() => ({ handlers, setHandlers }), [handlers]);
  return <ChatterRebillTipFabContext.Provider value={value}>{children}</ChatterRebillTipFabContext.Provider>;
}

/** Call from `ChatterHomeClient` to register openers; cleanup on unmount. */
export function useRegisterChatterRebillTipFabHandlers(
  openRebill: () => void,
  openTip: () => void
): void {
  const ctx = React.useContext(ChatterRebillTipFabContext);
  const rb = React.useRef(openRebill);
  const tp = React.useRef(openTip);
  rb.current = openRebill;
  tp.current = openTip;

  const setHandlers = ctx?.setHandlers;

  React.useEffect(() => {
    if (!setHandlers) return;
    setHandlers({
      openRebill: () => rb.current(),
      openTip: () => tp.current(),
    });
    return () => setHandlers(null);
  }, [setHandlers]);
}

export function useChatterRebillTipFabHandlers(): ChatterRebillTipFabHandlers | null {
  const ctx = React.useContext(ChatterRebillTipFabContext);
  return ctx?.handlers ?? null;
}
