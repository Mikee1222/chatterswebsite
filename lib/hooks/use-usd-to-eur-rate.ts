"use client";

import * as React from "react";
import { getUsdToEurRate } from "@/lib/exchange";

type FxResponse = {
  rate?: number;
  updatedAt?: number;
  fallback?: boolean;
};

export function useUsdToEurRate() {
  const [rate, setRate] = React.useState(getUsdToEurRate);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/client/fx?base=USD&quote=EUR");
        if (!res.ok) throw new Error("FX fetch failed");
        const data = (await res.json()) as FxResponse;
        if (!cancelled && typeof data.rate === "number" && data.rate > 0) {
          setRate(data.rate);
        }
      } catch {
        // Keep lib/exchange placeholder (0.92) when the API is unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const usdToEur = React.useCallback((usd: number) => usd * rate, [rate]);

  return { rate, usdToEur };
}
