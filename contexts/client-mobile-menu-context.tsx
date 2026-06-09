"use client";

import * as React from "react";

type ClientMobileMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const ClientMobileMenuContext = React.createContext<ClientMobileMenuContextValue | null>(null);

export function ClientMobileMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo(() => ({ open, setOpen }), [open]);
  return <ClientMobileMenuContext.Provider value={value}>{children}</ClientMobileMenuContext.Provider>;
}

export function useClientMobileMenu() {
  const ctx = React.useContext(ClientMobileMenuContext);
  if (!ctx) throw new Error("useClientMobileMenu must be used within ClientMobileMenuProvider");
  return ctx;
}
