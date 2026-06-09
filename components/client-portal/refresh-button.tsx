"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1000);
  }, [router]);

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={refreshing}
      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/60 transition-all hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
      <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
    </button>
  );
}
