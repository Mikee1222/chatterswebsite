"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Periodically refreshes server components (e.g. live shift lists) without full navigation.
 */
export function RouterRefreshInterval({
  children,
  intervalMs,
}: {
  children: React.ReactNode;
  intervalMs: number;
}) {
  const router = useRouter();

  React.useEffect(() => {
    if (intervalMs <= 0) return;
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return <>{children}</>;
}
