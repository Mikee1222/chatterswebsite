"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const MODEL_ROUTES_TO_PREFETCH = [
  "/model",
  "/model/schedule",
  "/model/content-assignments",
  "/model/content-calendar",
  "/model/custom-requests",
  "/settings",
] as const;

export function ModelRoutesPrefetcher() {
  const router = useRouter();

  useEffect(() => {
    for (const route of MODEL_ROUTES_TO_PREFETCH) {
      router.prefetch(route);
    }
  }, [router]);

  return null;
}
