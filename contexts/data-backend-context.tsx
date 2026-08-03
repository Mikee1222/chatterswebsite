"use client";

import * as React from "react";
import type { DataBackend } from "@/lib/data-backend";

const DataBackendContext = React.createContext<DataBackend>("airtable");

/**
 * Server layouts pass getDataBackend() so client components know when to
 * enable Supabase Realtime — without baking supabase into Production builds
 * via a misconfigured NEXT_PUBLIC_ flag.
 */
export function DataBackendProvider({
  backend,
  children,
}: {
  backend: DataBackend;
  children: React.ReactNode;
}) {
  return (
    <DataBackendContext.Provider value={backend}>{children}</DataBackendContext.Provider>
  );
}

export function useDataBackend(): DataBackend {
  return React.useContext(DataBackendContext);
}

export function useIsSupabaseBackend(): boolean {
  return useDataBackend() === "supabase";
}
