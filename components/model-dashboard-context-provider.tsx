"use client";

import * as React from "react";
import type { AuthUser } from "@/lib/auth-config";
import type { ModelRecord } from "@/types";

export type ModelDashboardContextValue = {
  user: AuthUser;
  linkedModelId: string | null;
  modelRecord: ModelRecord | null;
  language: "en" | "es";
};

const ModelDashboardContext = React.createContext<ModelDashboardContextValue | null>(null);

export function ModelDashboardContextProvider({
  value,
  children,
}: {
  value: ModelDashboardContextValue;
  children: React.ReactNode;
}) {
  return <ModelDashboardContext.Provider value={value}>{children}</ModelDashboardContext.Provider>;
}

export function useModelDashboardContext() {
  return React.useContext(ModelDashboardContext);
}
