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

export function useChatterRebillTipFabContext(): Ctx | null {
  return React.useContext(ChatterRebillTipFabContext);
}

/** Wraps dashboard shell so the chatter FAB can open rebill/tip modals (see {@link ChatterRebillTipFabHost}). */
export function ChatterRebillTipFabProvider({ children }: { children: React.ReactNode }) {
  const [handlers, setHandlersState] = React.useState<ChatterRebillTipFabHandlers | null>(null);
  const setHandlers = React.useCallback((next: ChatterRebillTipFabHandlers | null) => {
    setHandlersState(next);
  }, []);
  const value = React.useMemo(() => ({ handlers, setHandlers }), [handlers, setHandlers]);
  return <ChatterRebillTipFabContext.Provider value={value}>{children}</ChatterRebillTipFabContext.Provider>;
}

export function useChatterRebillTipFabHandlers(): ChatterRebillTipFabHandlers | null {
  const ctx = React.useContext(ChatterRebillTipFabContext);
  return ctx?.handlers ?? null;
}
